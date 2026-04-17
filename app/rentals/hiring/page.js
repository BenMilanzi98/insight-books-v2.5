import RentalsClient from "../RentalsClient";

export const metadata = {
  title: "Hiring | InsightBooks",
  description: "Equipment hiring with quantity-aware booking and invoicing.",
};

export default function HiringPage() {
  return <RentalsClient mode="hiring" />;
}
