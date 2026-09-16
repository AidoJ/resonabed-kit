# Professional client invoice

## What will change
- Restyle the invoice and receipt preview to follow the uploaded format: branded heading, clear invoice metadata, side-by-side billing and delivery details, structured line items, highlighted totals, payment information, and a polished footer.
- Use the ResonaBed logo and established indigo/violet palette consistently in both the on-screen preview and the printed or saved PDF.
- Preserve all current invoice data, GST calculations, receipt details, and payment instructions; unavailable template fields will be omitted rather than invented.
- Improve print sizing and page-break behaviour so the document remains a clean single-page A4 invoice where its content fits.

## Technical details
- Extend the invoice document component with a print-safe layout and scoped styles shared by the dialog and print window.
- Use the existing branded asset and semantic palette without changing invoice or payment business logic.
- Verify the invoice preview and print rendering in the running app, including a narrow-screen check.
