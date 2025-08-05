from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from datetime import datetime
from sqlalchemy import JSON

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import logging
from sqlalchemy.schema import CreateTable

DATABASE_URL = "postgresql+psycopg2://postgres:postgres-ec2@3.230.1.9:5432/postgres"

engine = create_engine(DATABASE_URL, echo=False, future=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class ExtractedDataHITL(Base):
    __tablename__ = "extracted_data_HITL"

    id = Column(Integer, primary_key=True, index=True)
    Unique_ID = Column(Integer)
    source_file = Column(String, nullable=False)
    temp_link = Column(String)
    # Invoice details
    invoice_type = Column(String)
    invoice_number = Column(String)
    invoice_date = Column(String)
    due_date = Column(String)
    place_of_supply = Column(String)
    irn_number = Column(String)
    ack_number = Column(String)
    ack_date = Column(String)

    # Vendor details
    vendor_name = Column(String)
    vendor_gstin = Column(String)
    vendor_pan = Column(String)
    vendor_email = Column(String)
    vendor_phone = Column(String)
    vendor_website = Column(String)
    vendor_street = Column(Text)
    vendor_city = Column(String)
    vendor_state = Column(String)
    vendor_pincode = Column(String)
    vendor_country = Column(String)

    # Vendor bank details
    bank_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    bank_branch = Column(String)

    # Client details
    client_name = Column(String)
    client_gstin = Column(String)
    client_pan = Column(String)
    client_email = Column(String)
    client_phone = Column(String)
    client_street = Column(Text)
    client_city = Column(String)
    client_state = Column(String)
    client_pincode = Column(String)
    client_country = Column(String)

    # Shipping details
    dispatch_mode = Column(String)
    tracking_number = Column(String)
    dispatch_date = Column(String)
    dispatch_destination = Column(String)

    # Tax details
    cgst_rate = Column(String)
    cgst_amount = Column(String)
    sgst_rate = Column(String)
    sgst_amount = Column(String)
    igst_rate = Column(String)
    igst_amount = Column(String)
    total_tax_amount = Column(String)

    # Payment summary
    discount = Column(String)
    roundoff = Column(String)
    taxable_value_total = Column(String)
    total_invoice_value = Column(String)
    total_invoice_value_in_words = Column(Text)
    amount_due = Column(String)
    payment_terms = Column(String)
    payment_status = Column(String)

    # Line item specific
    item_number = Column(String)
    hsn_sac_code = Column(String)
    description = Column(Text)
    quantity = Column(String)
    unit = Column(String)
    rate = Column(String)
    discount_percentage = Column(String)
    taxable_value = Column(String)
    IGST_percentage = Column(String)
    SGST_percentage  = Column(String)
    CGST_percentage = Column(String)
    IGST_value = Column(String)
    SGST_value = Column(String)
    CGST_value = Column(String)
    total_tax = Column(String)
    item_total = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    HITL = Column(Boolean)


class ValidationResult(Base):
    __tablename__ = "validation_results"
    id = Column(Integer, primary_key=True, index=True)
    Unique_ID = Column(Integer)
    source_file = Column(String, nullable=False)
    # invoice_metadata_score= Column(Float)
    # vendor_details_score= Column(Float)
    # client_details_score= Column(Float)
    invoice_details_score= Column(Float)
    line_items_score= Column(Float)
    tax_details_score= Column(Float)
    payment_summary_score= Column(Float)
    overall_score = Column(Float)
    errors_field = Column(String)
    error_extracted_value = Column(String)
    reason = Column(String)
    error_source_value = Column(String)
    error_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)




CreateTable(ValidationResult.__table__)
CreateTable(ExtractedDataHITL.__table__)
Base.metadata.create_all(bind=engine)