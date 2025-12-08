import { OrderQuery } from "@/lib/types/admin.generated";
import { GeneralParcel } from "../create-parcel-from-order";
import { shippo } from "@/lib/clients/shippo";
import { logger } from "../../logger";
import { requiresCustomsDeclaration, SHIPPO_FROM_ADDRESS } from "../shipping-utils";
import {
  AddressCreateRequest,
  CustomsDeclaration,
  CustomsDeclarationCreateRequest,
  CustomsItemCreateRequest,
  Shipment,
} from "shippo";
import { handleShippoError } from "./handle-shippo-errors";
import { shippingPriority } from "@drizzle/schema";
import { ShippingOptions } from "@/lib/types/shipping.types";
import { DataResponse } from "@/lib/types/misc";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

type Options = {
  shippingPriority?: (typeof shippingPriority.enumValues)[number];
} & Pick<ShippingOptions, "targetRateId">;

export const createShippoShipment = async (
  order: Order,
  parcel: GeneralParcel,
  options?: Options
): Promise<DataResponse<Shipment>> => {
  if (!order.shippingAddress) {
    logger.error("[create shippo shipment] Order has no shipping address", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "[create shippo shipment] Order has no shipping address" };
  }

  if (!order.shippingAddress?.countryCodeV2) {
    logger.error("[create shippo shipment] Order has no shipping address country", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "[create shippo shipment] Order has no shipping address country" };
  }
  try {
    const toAddress = await shippo.addresses.create({
      name: determineCustomerName(order),
      street1: order.shippingAddress?.address1 ?? undefined,
      street2: order.shippingAddress?.address2 ?? undefined,
      city: order.shippingAddress?.city ?? undefined,
      state: order.shippingAddress?.province ?? undefined,
      zip: order.shippingAddress?.zip ?? undefined,
      country: order.shippingAddress.countryCodeV2,
      phone: order.shippingAddress.phone ?? undefined,
      company: order.shippingAddress.company ?? undefined,
    });

    const shipmentRequiresCustoms = requiresCustomsDeclaration(order);
    let customs: CustomsDeclaration | undefined = undefined;

    if (shipmentRequiresCustoms) {
      customs = await shippo.customsDeclarations.create({
        certify: true,
        contentsType: "MERCHANDISE",
        certifySigner: "Daniel Parker",
        contentsExplanation: "Wholesale Clothing",
        nonDeliveryOption: "RETURN",
        incoterm: "DDU",
        eelPfc: "NOEEI_30_37_a",
        items: parcel.items.map(
          (item) =>
            ({
              massUnit: "oz",
              netWeight: item.weight.toString(),
              description: item.customsDescription,
              originCountry: "US",
              valueAmount: item.value.toString(),
              valueCurrency: "USD",
              hsCode: item.hsCode,
              quantity: item.quantity,
            } satisfies CustomsItemCreateRequest)
        ),
      } satisfies CustomsDeclarationCreateRequest);
    }

    const shipment = await shippo.shipments.create({
      addressTo: toAddress,
      addressFrom: SHIPPO_FROM_ADDRESS,
      parcels: [
        {
          distanceUnit: "cm",
          massUnit: "oz",
          height: parcel.parcelTemplate.heightCm,
          length: parcel.parcelTemplate.lengthCm,
          width: parcel.parcelTemplate.widthCm,
          weight: parcel.totalWeight.toString(),
        },
      ],
      customsDeclaration: customs?.objectId,
    });

    return { data: shipment, error: null };
  } catch (error) {
    const errorMessage = handleShippoError(error, order.id, "create shippo shipment");
    return { data: null, error: errorMessage };
  }
};

const determineCustomerName = (order: Order) => {
  const firstName = order.customer?.firstName || order.shippingAddress?.firstName;
  const lastName = order.customer?.lastName || order.shippingAddress?.lastName;

  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
};
