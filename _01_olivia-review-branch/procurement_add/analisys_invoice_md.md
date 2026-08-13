Here’s how you could convert the given JSON to a Markdown invoice layout, focusing on a clear header, a line-items table, and a summary block.

```markdown
# INVOICE

**Dawn Direct Ltd**

| | |
|---|---|
| **Invoice Number** | SI-230683 |
| **Date** | 17/06/2024 |
| **Customer** | Mussel and Steak Bar |

## Items

| Code | Description of Goods | Supplier No | Measure | Qty | Unit Price (£) | Amount (£) | Weight (kg) |
|------|----------------------|-------------|---------|-----|----------------|------------|-------------|
| LDA-2104 | FEELERS VINYL GLOVES (no powder) medium - BLUE | BPF102 | BOX 100 | 2 | 8.20 | 16.40 | 0.98 |
| LDA-2106 | FEELERS VINYL GLOVES (no powder) large - BLUE | BPF103 | BOX 100 | 2 | 8.20 | 16.40 | 1.05 |
| LDA-2108 | FEELERS VINYL GLOVES (no powder) ex-large - BLUE | BPF104 | BOX 100 | 1 | 8.20 | 8.20 | 0.54 |
| ... | *(additional items from full invoice)* | ... | ... | ... | ... | ... | ... |

## Totals

| Description | Value |
|-------------|-------|
| Total Nett | £508.02 |
| VAT (20%) | £101.60 |
| **Invoice Total** | **£609.62** |
| Total Weight | 107.60 kg |
```

**How this mapping works:**  

- The **header** is built from `report_metadata.company_name`, the invoice number implied by `file_name_suggestion` (e.g., `SI-230683`), the date from `report_generation_date`, and the customer extracted from the file name or `content_summary`.  
- The **line-items table** comes directly from the first entry in `table_structures`, using the `headers` array as column titles and the `sample_rows` as data rows. (The sample rows represent only part of the invoice – the full set would list all purchased goods, with the amounts summing to the totals.)  
- The **totals section** is derived from `key_metrics`, formatting `Total Nett`, `VAT`, `Invoice Total`, and `Total Weight` with their respective values and units.  
- `financial_categories` (`Catering Supplies`, `VAT`, `Total`) could optionally be used to group items or to label the summary rows, but in this simple layout the metrics already cover that structure.

You can automate this conversion by pulling the relevant fields from the JSON and rendering them into a Markdown template – optionally looping over all `table_structures` and their rows to produce a complete line-item table.