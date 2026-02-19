# TechsolushionsUtrecht Invoice System - Specification

## 1. Project Overview

**Project Name:** TechsolushionsUtrecht Factuur Systeem
**Type:** Web Application (React + Vite + Tailwind CSS)
**Core Functionality:** Create, share, and manage invoices (factuur) and proforma invoices (proforma) with email verification and approval workflow
**Target Users:** TechsolushionsUtrecht staff and their customers

## 2. Company Information

- **Name:** TechsolushionsUtrecht
- **Website:** https://www.techsolutionsutrecht.nl/
- **Phone:** +31 623434286
- **KVK Number:** 99202301
- **Email:** info@techsolutionsutrecht.nl

## 3. UI/UX Specification

### Layout Structure

- **Admin Dashboard:** Create/manage invoices with form and list view
- **Email Verification:** Login page with 6-digit code verification
- **Invoice Viewer:** Professional invoice display with approve button

### Visual Design

- **Primary Color:** Blue (#2563eb) - Purple gradient for branding
- **Secondary Color:** Green (#16a34a) for approval actions
- **Background:** Light gray (#f9fafb)
- **Invoice Header:** Blue to purple gradient
- **Typography:** System fonts, bold headings

### Components

1. **Invoice Form:** Tabs for proforma/invoice, client info, items, totals
2. **Verification:** Email input + 6-digit OTP input
3. **Invoice Display:** Professional layout with company branding
4. **Action Buttons:** Download PDF, Print, Approve

## 4. Functionality Specification

### Core Features

1. **Create Invoice/Proforma**
   - Select type (proforma or invoice)
   - Enter client details (name, email, company, address, KVK)
   - Add line items (description, quantity, price)
   - Auto-calculate subtotal, VAT, total
   - Set due date

2. **Share Invoice**
   - Generate unique link
   - Copy link to clipboard

3. **Email Verification (Recipient)**
   - Enter email address
   - Receive 6-digit verification code
   - Enter code to view invoice

4. **View Invoice**
   - Professional invoice display
   - Download as PDF
   - Print invoice
   - Approve button (for pending invoices)

5. **Approval Workflow**
   - Client clicks approve
   - Status changes to "approved"
   - Confirmation emails sent to:
     - info@techsolutionsutrecht.nl
     - Client email

### Invoice Number Format

- Proforma: PI-YYYY-XXXX
- Invoice: INV-YYYY-XXXX

## 5. Translations (Dutch)

All UI text translated to Dutch:

- Dashboard: "Factuurbeheer"
- Create: "Nieuwe Factuur Maken"
- Proforma: "Proforma"
- Invoice: "Factuur"
- Client: "Klant"
- Due Date: "Vervaldatum"
- VAT: "BTW"
- Total: "Totaal"
- Verify: "Verifiëren"
- Code: "Code"
- Send Code: "Code Verzenden"
- Approve: "Goedkeuren"
- Approved: "Goedgekeurd"
- Pending: "In Afwachting"
- Download PDF: "PDF Downloaden"
- Print: "Afdrukken"

## 6. Acceptance Criteria

- [ ] Admin can create proforma and invoice
- [ ] Shareable link is generated for each invoice
- [ ] Recipient must verify email with 6-digit code
- [ ] Invoice displays with company branding
- [ ] PDF download works correctly
- [ ] Approval sends confirmation emails (simulated)
- [ ] All text is in Dutch
- [ ] Application builds without errors
