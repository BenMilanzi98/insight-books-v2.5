import RentalsClient from "../RentalsClient";

export const metadata = {
  title: "Quantity rentals | InsightBooks",
  description: "Outbound equipment pool rentals with quantity-aware booking and invoicing.",
};

export default function HiringPage() {
  return <RentalsClient mode="hiring" />;
}
