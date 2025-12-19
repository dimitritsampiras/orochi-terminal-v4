import { OrderQuery } from "@/lib/types/admin.generated";
import { Card, CardTitle, CardContent, CardHeader } from "../ui/card";

type Order = NonNullable<OrderQuery["node"]> & { __typename: "Order" };
type Customer = NonNullable<Order["customer"]>;
type ShippingAddress = NonNullable<Order["shippingAddress"]>;

export const CustomerCard = ({
  customer,
  shippingAddress,
}: {
  customer: Customer;
  shippingAddress?: ShippingAddress;
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Info</CardTitle>
      </CardHeader>
      <CardContent className="text-sm ">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            {customer.firstName} {customer.lastName}
          </div>
          <div>
            {customer.numberOfOrders} order{customer.numberOfOrders === 1 ? "" : "s"}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Address 1: </span>
          <span className="font-medium">{shippingAddress?.address1}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Address 2: </span>
          <span className="font-medium">{shippingAddress?.address2}</span>
        </div>
        <div>
          <span className="text-muted-foreground">City: </span>
          <span className="font-medium">{shippingAddress?.city}</span>
        </div>
        <div>
          <span className="text-muted-foreground">State: </span>
          <span className="font-medium">{shippingAddress?.province || shippingAddress?.provinceCode}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Country: </span>
          <span className="font-medium">{shippingAddress?.country || shippingAddress?.countryCodeV2}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Zip: </span>
          <span className="font-medium">{shippingAddress?.zip}</span>
        </div>
      </CardContent>
    </Card>
  );
};
