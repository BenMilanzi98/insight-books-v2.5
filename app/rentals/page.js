import RentalsClient from "./RentalsClient";

export const metadata = {
  title: "Rentals | InsightBooks",
  description: "Room and space rentals with invoicing and availability.",
};

export default function RentalsPage() {
  return <RentalsClient mode="rental" />;
}
