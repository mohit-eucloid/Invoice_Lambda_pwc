import json
import boto3
import tempfile
import os
import base64
import requests
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from google import genai
from google.genai import types

# Initialize S3 client
s3_client = boto3.client('s3')

# Initialize FastAPI app
app = FastAPI(title="PDF Processing Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"],
)

# Pydantic models for request validation
class ProcessPDFRequest(BaseModel):
    api_key: str
    file_content: Optional[str] = None  # base64 encoded
    s3_url: Optional[str] = None
    s3_bucket: Optional[str] = None
    s3_key: Optional[str] = None
    file_id: Optional[str] = None
    upload_timestamp: Optional[str] = None
    original_filename: Optional[str] = None
    custom_prompt: Optional[str] = None
    custom_system_prompt: Optional[str] = None
    model_name: Optional[str] = "gemini-2.0-flash-001"
    temperature: Optional[float] = 0.0
    top_k: Optional[int] = None
    top_p: Optional[float] = None
    enable_search: Optional[bool] = False
    output_format: Optional[str] = "json"

def get_cors_headers():
    """Return consistent CORS headers for all responses"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

def download_file_from_s3_url(s3_url, bucket_name=None, s3_key=None):
    """
    Download file from S3 using either a presigned URL or bucket/key combination.
    """
    try:
        if s3_url:
            # Download using presigned URL
            response = requests.get(s3_url, timeout=30)
            response.raise_for_status()
            return response.content
        elif bucket_name and s3_key:
            # Download directly from S3 using boto3
            response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
            return response['Body'].read()
        else:
            raise ValueError("Either s3_url or both bucket_name and s3_key must be provided")
    except Exception as e:
        raise Exception(f"Failed to download file from S3: {str(e)}")

def process_with_gemini(file_content, api_key, custom_prompt=None, custom_system_prompt=None, model_name="gemini-2.0-flash-001", temp_value=0.0, top_k_value=None, top_p_value=None, enable_search=False, output_format='json'):
    """
    Processes PDF content using the new Gemini API with custom prompts.

    Args:
        file_content (bytes): The byte content of the PDF file.
        api_key (str): Your Google AI API key.
        custom_prompt (str, optional): A custom prompt for data extraction.
        custom_system_prompt (str, optional): A custom system-level instruction.
        model_name (str, optional): The name of the Gemini model to use.
        temp_value (float, optional): The temperature for generation.
        top_k_value (int, optional): The top-k sampling parameter.
        top_p_value (float, optional): The top-p sampling parameter.
        enable_search (bool, optional): Whether to enable Google Search tool.
        output_format (str, optional): Output format - 'json' or 'text'.

    Returns:
        str: The processed text from the Gemini API or an error JSON.
    """
    
    try:
        # Initialize the client with API key
        client = genai.Client(api_key=api_key)
        
        # Create temporary file for the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        # Upload the file using the client's files service
        uploaded_file = client.files.upload(file=temp_file_path)
        
        # Set up the user prompt. Use the custom one if provided, otherwise use a default.
        user_prompt = custom_prompt or "Extract all data from this invoice and format it as a clean JSON object. Include all line items."
        
        # Configure tools if needed
        tools = []
        if enable_search:
            tools.append(types.Tool(googleSearch=types.GoogleSearch()))
        
        # Configure generation settings
        mime_type = "application/json" if output_format.lower() == 'json' else "text/plain"
        
        generation_config = types.GenerateContentConfig(
            temperature=temp_value,
            top_p=top_p_value,
            top_k=top_k_value,
            max_output_tokens=60000,
            response_mime_type=mime_type,
            system_instruction=custom_system_prompt or "You are an expert at extracting structured data from documents."
        )
        
        # Add tools to config if any
        if tools:
            generation_config.tools = tools
        print("Running a chat thread")
        # Generate content using the new API with the simpler syntax
        response = client.models.generate_content(
            model=model_name,
            contents=[user_prompt, uploaded_file],
            config=generation_config
        )
        print(response)
        return response.text
            
    except Exception as e:
        # Raise a detailed exception for the handler to catch
        print(f"Error during Gemini processing: {e}")
        raise Exception(f"Gemini API error: {str(e)}")
    finally:
        # Clean up the temporary file
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "PDF Processing Service is running"}

@app.post("/invoice_process")
async def process_pdf_endpoint(request: ProcessPDFRequest):
    """
    FastAPI endpoint at /invoice_process that supports multiple input methods:
    1. S3 presigned URL
    2. S3 bucket + key
    3. File ID from upload function
    4. Base64 file content (backward compatibility)
    
    Then processes the file with Gemini API.
    """
    try:
        # Log the incoming request for debugging
        print(f"Received request: {request.model_dump()}")

        # Determine input method and get file content
        file_content = None
        
        # Method 1: Base64 file content (backward compatibility)
        if request.file_content:
            try:
                file_content = base64.b64decode(request.file_content)
                print("Using base64 file content")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f'Invalid base64 for file_content: {str(e)}'
                )
        
        # Method 2: S3 presigned URL
        elif request.s3_url:
            try:
                file_content = download_file_from_s3_url(s3_url=request.s3_url)
                print("Downloaded from S3 presigned URL")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f'Failed to download from S3 URL: {str(e)}'
                )
        
        # Method 3: S3 bucket and key
        elif request.s3_bucket and request.s3_key:
            try:
                file_content = download_file_from_s3_url(
                    s3_url=None,
                    bucket_name=request.s3_bucket, 
                    s3_key=request.s3_key
                )
                print("Downloaded from S3 using bucket/key")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f'Failed to download from S3: {str(e)}'
                )
        
        # Method 4: File ID from upload function response
        elif request.file_id and request.s3_bucket:
            timestamp = request.upload_timestamp or ''
            original_filename = request.original_filename or 'file.pdf'
            s3_key = f"invoices/uploads/{timestamp}_{request.file_id}_{original_filename}"
            
            try:
                file_content = download_file_from_s3_url(
                    s3_url=None,
                    bucket_name=request.s3_bucket, 
                    s3_key=s3_key
                )
                print("Downloaded using file ID")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f'Failed to download file using file_id: {str(e)}'
                )
        
        else:
            raise HTTPException(
                status_code=400,
                detail='Missing file input. Provide one of: file_content (base64), s3_url, s3_bucket+s3_key, or file_id+s3_bucket'
            )

        # Check if we got file content
        if not file_content:
            raise HTTPException(
                status_code=400,
                detail='Failed to obtain file content'
            )

        # Process with Gemini API
        result_text = process_with_gemini(
            file_content=file_content,
            api_key=request.api_key,
            custom_prompt=request.custom_prompt,
            custom_system_prompt=request.custom_system_prompt,
            model_name=request.model_name,
            temp_value=request.temperature,
            top_k_value=request.top_k,
            top_p_value=request.top_p,
            enable_search=request.enable_search,
            output_format=request.output_format
        )

        # Improved JSON handling
        if request.output_format.lower() == 'json':
            # Clean the result text before parsing
            cleaned_result = result_text.strip()
            
            # Remove common AI response artifacts
            if cleaned_result.startswith('```json'):
                cleaned_result = cleaned_result[7:]  # Remove ```json
            if cleaned_result.endswith('```'):
                cleaned_result = cleaned_result[:-3]  # Remove ```
            
            cleaned_result = cleaned_result.strip()
            
            # Try multiple parsing strategies
            parsed_data = None
            
            # Strategy 1: Direct JSON parsing
            try:
                parsed_data = json.loads(cleaned_result)
                print("Successfully parsed JSON directly")
            except json.JSONDecodeError as e:
                print(f"Direct JSON parsing failed: {e}")
                
                # Strategy 2: Try to find JSON array/object in the text
                try:
                    # Look for JSON array starting with [
                    if '[' in cleaned_result and ']' in cleaned_result:
                        start_idx = cleaned_result.find('[')
                        end_idx = cleaned_result.rfind(']') + 1
                        json_part = cleaned_result[start_idx:end_idx]
                        parsed_data = json.loads(json_part)
                        print("Successfully parsed JSON array from text")
                    # Look for JSON object starting with {
                    elif '{' in cleaned_result and '}' in cleaned_result:
                        start_idx = cleaned_result.find('{')
                        end_idx = cleaned_result.rfind('}') + 1
                        json_part = cleaned_result[start_idx:end_idx]
                        parsed_data = json.loads(json_part)
                        print("Successfully parsed JSON object from text")
                except json.JSONDecodeError as e2:
                    print(f"Extraction-based JSON parsing also failed: {e2}")
            
            # Return parsed data directly or fallback
            if parsed_data is not None:
                # Return the parsed data directly (not wrapped in {"result": ...})
                return parsed_data
            
            else:
                # If all parsing fails, return error with raw text for debugging
                print(f"All JSON parsing failed. Raw result: {result_text[:500]}...")
                return {
                    "error": "Failed to parse JSON response",
                    "raw_result": result_text,
                    "parsing_attempts": [
                        "Direct JSON parsing failed",
                        "JSON extraction from text failed"
                    ]
                }
        else:
            # For non-JSON formats, return wrapped in result
            return {"result": result_text}

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the error
        print(f"Unhandled error: {str(e)}")
        # Return a server error response
        raise HTTPException(
            status_code=500,
            detail=f'An internal server error occurred: {str(e)}'
        )

# Optional: Add a custom exception handler for better error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
        headers=get_cors_headers()
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)