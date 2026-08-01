export function hasActiveTaxTypes(taxTypes) {
  return Array.isArray(taxTypes) && taxTypes.length > 0;
}

export async function fetchActiveTaxTypes() {
  const response = await fetch('/api/tax-types?status=Active');
  if (!response.ok) {
    throw new Error(`Failed to load tax types: ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data.taxTypes || data.data || [];
}
