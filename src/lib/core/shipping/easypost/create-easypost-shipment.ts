import { OrderQuery } from "@/lib/types/admin.generated";
import { GeneralParcel } from "../create-parcel-from-order";

import { logger } from "../../logger";
import { EASYPOST_FROM_ADDRESS, requiresCustomsDeclaration } from "../shipping-utils";

import { shippingPriority } from "@drizzle/schema";
import { ShippingOptions } from "@/lib/types/shipping.types";
import { easypost } from "@/lib/clients/easypost";
import { IAddressCreateParameters, IShipmentCreateParameters, Shipment } from "@easypost/api";
import { DataResponse } from "@/lib/types/misc";
import { handleEasypostError } from "./handle-easypost-errors";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

type Options = {
  shippingPriority?: (typeof shippingPriority.enumValues)[number];
} & Pick<ShippingOptions, "targetRateId">;

export const createEasypostShipment = async (
  order: Order,
  parcel: GeneralParcel,
  options?: Options
): Promise<DataResponse<Shipment>> => {
  if (!order.shippingAddress) {
    logger.error("[create easypost shipment] Order has no shipping address", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "[create easypost shipment] Order has no shipping address" };
  }

  if (!order.shippingAddress?.countryCodeV2) {
    logger.error("[create easypost shipment] Order has no shipping address country", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "[create easypost shipment] Order has no shipping address country" };
  }

  if (!order.shippingAddress?.zip) {
    logger.warn("[create easypost shipment] Easypost requires zip - setting as empty", {
      category: "SHIPPING",
      orderId: order.id,
    });
  }

  try {
    const toAddress = await easypost.Address.create({
      name: determineCustomerName(order),
      street1: order.shippingAddress?.address1 ?? undefined,
      street2: order.shippingAddress?.address2 ?? undefined,
      city: order.shippingAddress?.city ?? undefined,
      state: order.shippingAddress?.province ?? undefined,
      zip: order.shippingAddress?.zip ?? "",
      country: order.shippingAddress.countryCodeV2,
      phone: order.shippingAddress.phone ?? undefined,
      company: order.shippingAddress.company ?? undefined,
    } satisfies IAddressCreateParameters);

    const shipmentRequiresCustoms = requiresCustomsDeclaration(order);
    let customs: IShipmentCreateParameters["customs_info"] | undefined = undefined;

    if (shipmentRequiresCustoms) {
      customs = await easypost.CustomsInfo.create({
        customs_certify: true,
        contents_type: "merchandise",
        customs_signer: "Daniel Parker",
        contents_explanation: "Wholesale Clothing",
        non_delivery_option: "return",
        restriction_type: "none",
        restriction_comments: "none",
        eel_pfc: "NOEEI 30.37(a)",
        customs_items: parcel.items.map((item) => ({
          code: item.sku,
          description: item.customsDescription,
          hs_tariff_number: item.hsCode,
          weight: item.weight,
          value: item.value,
          quantity: item.quantity,
          origin_country: "US",
        })),
      } satisfies IShipmentCreateParameters["customs_info"]);
    }

    const shipment = await easypost.Shipment.create({
      to_address: toAddress,
      from_address: EASYPOST_FROM_ADDRESS,
      parcel: {
        weight: parcel.totalWeight,
        height: parseFloat(parcel.parcelTemplate.heightCm),
        length: parseFloat(parcel.parcelTemplate.lengthCm),
        width: parseFloat(parcel.parcelTemplate.widthCm),
      },
      customs_info: customs,
    } satisfies IShipmentCreateParameters);

    return { data: shipment, error: null };
  } catch (error) {
    const errorMessage = handleEasypostError(error, order.id, "create easypost shipment");
    return { data: null, error: errorMessage };
  }
};

const determineCustomerName = (order: Order) => {
  const firstName = order.customer?.firstName || order.shippingAddress?.firstName;
  const lastName = order.customer?.lastName || order.shippingAddress?.lastName;

  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
};
