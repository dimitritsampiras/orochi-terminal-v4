/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types';

export type OrderQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type OrderQuery = { node?: AdminTypes.Maybe<(
    { __typename: 'AbandonedCheckout' }
    & Pick<AdminTypes.AbandonedCheckout, 'id'>
  ) | (
    { __typename: 'AbandonedCheckoutLineItem' }
    & Pick<AdminTypes.AbandonedCheckoutLineItem, 'id'>
  ) | (
    { __typename: 'Abandonment' }
    & Pick<AdminTypes.Abandonment, 'id'>
  ) | (
    { __typename: 'AddAllProductsOperation' }
    & Pick<AdminTypes.AddAllProductsOperation, 'id'>
  ) | (
    { __typename: 'AdditionalFee' }
    & Pick<AdminTypes.AdditionalFee, 'id'>
  ) | (
    { __typename: 'App' }
    & Pick<AdminTypes.App, 'id'>
  ) | (
    { __typename: 'AppCatalog' }
    & Pick<AdminTypes.AppCatalog, 'id'>
  ) | (
    { __typename: 'AppCredit' }
    & Pick<AdminTypes.AppCredit, 'id'>
  ) | (
    { __typename: 'AppInstallation' }
    & Pick<AdminTypes.AppInstallation, 'id'>
  ) | (
    { __typename: 'AppPurchaseOneTime' }
    & Pick<AdminTypes.AppPurchaseOneTime, 'id'>
  ) | (
    { __typename: 'AppRevenueAttributionRecord' }
    & Pick<AdminTypes.AppRevenueAttributionRecord, 'id'>
  ) | (
    { __typename: 'AppSubscription' }
    & Pick<AdminTypes.AppSubscription, 'id'>
  ) | (
    { __typename: 'AppUsageRecord' }
    & Pick<AdminTypes.AppUsageRecord, 'id'>
  ) | (
    { __typename: 'Article' }
    & Pick<AdminTypes.Article, 'id'>
  ) | (
    { __typename: 'BasicEvent' }
    & Pick<AdminTypes.BasicEvent, 'id'>
  ) | (
    { __typename: 'Blog' }
    & Pick<AdminTypes.Blog, 'id'>
  ) | (
    { __typename: 'BulkOperation' }
    & Pick<AdminTypes.BulkOperation, 'id'>
  ) | (
    { __typename: 'BusinessEntity' }
    & Pick<AdminTypes.BusinessEntity, 'id'>
  ) | (
    { __typename: 'CalculatedOrder' }
    & Pick<AdminTypes.CalculatedOrder, 'id'>
  ) | (
    { __typename: 'CartTransform' }
    & Pick<AdminTypes.CartTransform, 'id'>
  ) | (
    { __typename: 'CashTrackingAdjustment' }
    & Pick<AdminTypes.CashTrackingAdjustment, 'id'>
  ) | (
    { __typename: 'CashTrackingSession' }
    & Pick<AdminTypes.CashTrackingSession, 'id'>
  ) | (
    { __typename: 'CatalogCsvOperation' }
    & Pick<AdminTypes.CatalogCsvOperation, 'id'>
  ) | (
    { __typename: 'Channel' }
    & Pick<AdminTypes.Channel, 'id'>
  ) | (
    { __typename: 'ChannelDefinition' }
    & Pick<AdminTypes.ChannelDefinition, 'id'>
  ) | (
    { __typename: 'ChannelInformation' }
    & Pick<AdminTypes.ChannelInformation, 'id'>
  ) | (
    { __typename: 'CheckoutProfile' }
    & Pick<AdminTypes.CheckoutProfile, 'id'>
  ) | (
    { __typename: 'Collection' }
    & Pick<AdminTypes.Collection, 'id'>
  ) | (
    { __typename: 'Comment' }
    & Pick<AdminTypes.Comment, 'id'>
  ) | (
    { __typename: 'CommentEvent' }
    & Pick<AdminTypes.CommentEvent, 'id'>
  ) | (
    { __typename: 'Company' }
    & Pick<AdminTypes.Company, 'id'>
  ) | (
    { __typename: 'CompanyAddress' }
    & Pick<AdminTypes.CompanyAddress, 'id'>
  ) | (
    { __typename: 'CompanyContact' }
    & Pick<AdminTypes.CompanyContact, 'id'>
  ) | (
    { __typename: 'CompanyContactRole' }
    & Pick<AdminTypes.CompanyContactRole, 'id'>
  ) | (
    { __typename: 'CompanyContactRoleAssignment' }
    & Pick<AdminTypes.CompanyContactRoleAssignment, 'id'>
  ) | (
    { __typename: 'CompanyLocation' }
    & Pick<AdminTypes.CompanyLocation, 'id'>
  ) | (
    { __typename: 'CompanyLocationCatalog' }
    & Pick<AdminTypes.CompanyLocationCatalog, 'id'>
  ) | (
    { __typename: 'CompanyLocationStaffMemberAssignment' }
    & Pick<AdminTypes.CompanyLocationStaffMemberAssignment, 'id'>
  ) | (
    { __typename: 'ConsentPolicy' }
    & Pick<AdminTypes.ConsentPolicy, 'id'>
  ) | (
    { __typename: 'CurrencyExchangeAdjustment' }
    & Pick<AdminTypes.CurrencyExchangeAdjustment, 'id'>
  ) | (
    { __typename: 'Customer' }
    & Pick<AdminTypes.Customer, 'id'>
  ) | (
    { __typename: 'CustomerAccountAppExtensionPage' }
    & Pick<AdminTypes.CustomerAccountAppExtensionPage, 'id'>
  ) | (
    { __typename: 'CustomerAccountNativePage' }
    & Pick<AdminTypes.CustomerAccountNativePage, 'id'>
  ) | (
    { __typename: 'CustomerPaymentMethod' }
    & Pick<AdminTypes.CustomerPaymentMethod, 'id'>
  ) | (
    { __typename: 'CustomerSegmentMembersQuery' }
    & Pick<AdminTypes.CustomerSegmentMembersQuery, 'id'>
  ) | (
    { __typename: 'CustomerVisit' }
    & Pick<AdminTypes.CustomerVisit, 'id'>
  ) | (
    { __typename: 'DeliveryCarrierService' }
    & Pick<AdminTypes.DeliveryCarrierService, 'id'>
  ) | (
    { __typename: 'DeliveryCondition' }
    & Pick<AdminTypes.DeliveryCondition, 'id'>
  ) | (
    { __typename: 'DeliveryCountry' }
    & Pick<AdminTypes.DeliveryCountry, 'id'>
  ) | (
    { __typename: 'DeliveryCustomization' }
    & Pick<AdminTypes.DeliveryCustomization, 'id'>
  ) | (
    { __typename: 'DeliveryLocationGroup' }
    & Pick<AdminTypes.DeliveryLocationGroup, 'id'>
  ) | (
    { __typename: 'DeliveryMethod' }
    & Pick<AdminTypes.DeliveryMethod, 'id'>
  ) | (
    { __typename: 'DeliveryMethodDefinition' }
    & Pick<AdminTypes.DeliveryMethodDefinition, 'id'>
  ) | (
    { __typename: 'DeliveryParticipant' }
    & Pick<AdminTypes.DeliveryParticipant, 'id'>
  ) | (
    { __typename: 'DeliveryProfile' }
    & Pick<AdminTypes.DeliveryProfile, 'id'>
  ) | (
    { __typename: 'DeliveryProfileItem' }
    & Pick<AdminTypes.DeliveryProfileItem, 'id'>
  ) | (
    { __typename: 'DeliveryPromiseParticipant' }
    & Pick<AdminTypes.DeliveryPromiseParticipant, 'id'>
  ) | (
    { __typename: 'DeliveryPromiseProvider' }
    & Pick<AdminTypes.DeliveryPromiseProvider, 'id'>
  ) | (
    { __typename: 'DeliveryProvince' }
    & Pick<AdminTypes.DeliveryProvince, 'id'>
  ) | (
    { __typename: 'DeliveryRateDefinition' }
    & Pick<AdminTypes.DeliveryRateDefinition, 'id'>
  ) | (
    { __typename: 'DeliveryZone' }
    & Pick<AdminTypes.DeliveryZone, 'id'>
  ) | (
    { __typename: 'DiscountAutomaticBxgy' }
    & Pick<AdminTypes.DiscountAutomaticBxgy, 'id'>
  ) | (
    { __typename: 'DiscountAutomaticNode' }
    & Pick<AdminTypes.DiscountAutomaticNode, 'id'>
  ) | (
    { __typename: 'DiscountCodeNode' }
    & Pick<AdminTypes.DiscountCodeNode, 'id'>
  ) | (
    { __typename: 'DiscountNode' }
    & Pick<AdminTypes.DiscountNode, 'id'>
  ) | (
    { __typename: 'DiscountRedeemCodeBulkCreation' }
    & Pick<AdminTypes.DiscountRedeemCodeBulkCreation, 'id'>
  ) | (
    { __typename: 'Domain' }
    & Pick<AdminTypes.Domain, 'id'>
  ) | (
    { __typename: 'DraftOrder' }
    & Pick<AdminTypes.DraftOrder, 'id'>
  ) | (
    { __typename: 'DraftOrderLineItem' }
    & Pick<AdminTypes.DraftOrderLineItem, 'id'>
  ) | (
    { __typename: 'DraftOrderTag' }
    & Pick<AdminTypes.DraftOrderTag, 'id'>
  ) | (
    { __typename: 'Duty' }
    & Pick<AdminTypes.Duty, 'id'>
  ) | (
    { __typename: 'ExchangeLineItem' }
    & Pick<AdminTypes.ExchangeLineItem, 'id'>
  ) | (
    { __typename: 'ExchangeV2' }
    & Pick<AdminTypes.ExchangeV2, 'id'>
  ) | (
    { __typename: 'ExternalVideo' }
    & Pick<AdminTypes.ExternalVideo, 'id'>
  ) | (
    { __typename: 'Fulfillment' }
    & Pick<AdminTypes.Fulfillment, 'id'>
  ) | (
    { __typename: 'FulfillmentConstraintRule' }
    & Pick<AdminTypes.FulfillmentConstraintRule, 'id'>
  ) | (
    { __typename: 'FulfillmentEvent' }
    & Pick<AdminTypes.FulfillmentEvent, 'id'>
  ) | (
    { __typename: 'FulfillmentHold' }
    & Pick<AdminTypes.FulfillmentHold, 'id'>
  ) | (
    { __typename: 'FulfillmentLineItem' }
    & Pick<AdminTypes.FulfillmentLineItem, 'id'>
  ) | (
    { __typename: 'FulfillmentOrder' }
    & Pick<AdminTypes.FulfillmentOrder, 'id'>
  ) | (
    { __typename: 'FulfillmentOrderDestination' }
    & Pick<AdminTypes.FulfillmentOrderDestination, 'id'>
  ) | (
    { __typename: 'FulfillmentOrderLineItem' }
    & Pick<AdminTypes.FulfillmentOrderLineItem, 'id'>
  ) | (
    { __typename: 'FulfillmentOrderMerchantRequest' }
    & Pick<AdminTypes.FulfillmentOrderMerchantRequest, 'id'>
  ) | (
    { __typename: 'GenericFile' }
    & Pick<AdminTypes.GenericFile, 'id'>
  ) | (
    { __typename: 'GiftCard' }
    & Pick<AdminTypes.GiftCard, 'id'>
  ) | (
    { __typename: 'GiftCardCreditTransaction' }
    & Pick<AdminTypes.GiftCardCreditTransaction, 'id'>
  ) | (
    { __typename: 'GiftCardDebitTransaction' }
    & Pick<AdminTypes.GiftCardDebitTransaction, 'id'>
  ) | (
    { __typename: 'InventoryAdjustmentGroup' }
    & Pick<AdminTypes.InventoryAdjustmentGroup, 'id'>
  ) | (
    { __typename: 'InventoryItem' }
    & Pick<AdminTypes.InventoryItem, 'id'>
  ) | (
    { __typename: 'InventoryItemMeasurement' }
    & Pick<AdminTypes.InventoryItemMeasurement, 'id'>
  ) | (
    { __typename: 'InventoryLevel' }
    & Pick<AdminTypes.InventoryLevel, 'id'>
  ) | (
    { __typename: 'InventoryQuantity' }
    & Pick<AdminTypes.InventoryQuantity, 'id'>
  ) | (
    { __typename: 'InventoryShipment' }
    & Pick<AdminTypes.InventoryShipment, 'id'>
  ) | (
    { __typename: 'InventoryShipmentLineItem' }
    & Pick<AdminTypes.InventoryShipmentLineItem, 'id'>
  ) | (
    { __typename: 'InventoryTransfer' }
    & Pick<AdminTypes.InventoryTransfer, 'id'>
  ) | (
    { __typename: 'InventoryTransferLineItem' }
    & Pick<AdminTypes.InventoryTransferLineItem, 'id'>
  ) | (
    { __typename: 'LineItem' }
    & Pick<AdminTypes.LineItem, 'id'>
  ) | (
    { __typename: 'LineItemGroup' }
    & Pick<AdminTypes.LineItemGroup, 'id'>
  ) | (
    { __typename: 'Location' }
    & Pick<AdminTypes.Location, 'id'>
  ) | (
    { __typename: 'MailingAddress' }
    & Pick<AdminTypes.MailingAddress, 'id'>
  ) | (
    { __typename: 'Market' }
    & Pick<AdminTypes.Market, 'id'>
  ) | (
    { __typename: 'MarketCatalog' }
    & Pick<AdminTypes.MarketCatalog, 'id'>
  ) | (
    { __typename: 'MarketRegionCountry' }
    & Pick<AdminTypes.MarketRegionCountry, 'id'>
  ) | (
    { __typename: 'MarketWebPresence' }
    & Pick<AdminTypes.MarketWebPresence, 'id'>
  ) | (
    { __typename: 'MarketingActivity' }
    & Pick<AdminTypes.MarketingActivity, 'id'>
  ) | (
    { __typename: 'MarketingEvent' }
    & Pick<AdminTypes.MarketingEvent, 'id'>
  ) | (
    { __typename: 'MediaImage' }
    & Pick<AdminTypes.MediaImage, 'id'>
  ) | (
    { __typename: 'Menu' }
    & Pick<AdminTypes.Menu, 'id'>
  ) | (
    { __typename: 'Metafield' }
    & Pick<AdminTypes.Metafield, 'id'>
  ) | (
    { __typename: 'MetafieldDefinition' }
    & Pick<AdminTypes.MetafieldDefinition, 'id'>
  ) | (
    { __typename: 'Metaobject' }
    & Pick<AdminTypes.Metaobject, 'id'>
  ) | (
    { __typename: 'MetaobjectDefinition' }
    & Pick<AdminTypes.MetaobjectDefinition, 'id'>
  ) | (
    { __typename: 'Model3d' }
    & Pick<AdminTypes.Model3d, 'id'>
  ) | (
    { __typename: 'OnlineStoreTheme' }
    & Pick<AdminTypes.OnlineStoreTheme, 'id'>
  ) | (
    { __typename: 'Order' }
    & Pick<AdminTypes.Order, 'name' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'note' | 'displayFinancialStatus' | 'discountCodes' | 'displayFulfillmentStatus' | 'id'>
    & { totalPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, risk: { assessments: Array<Pick<AdminTypes.OrderRiskAssessment, 'riskLevel'>> }, localizedFields: { nodes: Array<Pick<AdminTypes.LocalizedField, 'key' | 'purpose' | 'value'>> }, customer?: AdminTypes.Maybe<Pick<AdminTypes.Customer, 'firstName' | 'lastName' | 'numberOfOrders' | 'email' | 'tags'>>, app?: AdminTypes.Maybe<Pick<AdminTypes.OrderApp, 'name'>>, shippingLine?: AdminTypes.Maybe<Pick<AdminTypes.ShippingLine, 'title'>>, shippingAddress?: AdminTypes.Maybe<Pick<AdminTypes.MailingAddress, 'address1' | 'address2' | 'city' | 'country' | 'countryCodeV2' | 'firstName' | 'lastName' | 'phone' | 'company' | 'provinceCode' | 'province' | 'zip'>>, lineItems: { nodes: Array<(
        Pick<AdminTypes.LineItem, 'id' | 'title' | 'variantTitle' | 'quantity' | 'name' | 'vendor' | 'unfulfilledQuantity' | 'requiresShipping' | 'nonFulfillableQuantity'>
        & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'url'>>, originalTotalSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount'> }, variant?: AdminTypes.Maybe<(
          Pick<AdminTypes.ProductVariant, 'id'>
          & { inventoryItem: { measurement: { weight?: AdminTypes.Maybe<Pick<AdminTypes.Weight, 'unit' | 'value'>> } } }
        )>, product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id' | 'tracksInventory' | 'productType'>> }
      )> } }
  ) | (
    { __typename: 'OrderAdjustment' }
    & Pick<AdminTypes.OrderAdjustment, 'id'>
  ) | (
    { __typename: 'OrderDisputeSummary' }
    & Pick<AdminTypes.OrderDisputeSummary, 'id'>
  ) | (
    { __typename: 'OrderEditSession' }
    & Pick<AdminTypes.OrderEditSession, 'id'>
  ) | (
    { __typename: 'OrderTransaction' }
    & Pick<AdminTypes.OrderTransaction, 'id'>
  ) | (
    { __typename: 'Page' }
    & Pick<AdminTypes.Page, 'id'>
  ) | (
    { __typename: 'PaymentCustomization' }
    & Pick<AdminTypes.PaymentCustomization, 'id'>
  ) | (
    { __typename: 'PaymentMandate' }
    & Pick<AdminTypes.PaymentMandate, 'id'>
  ) | (
    { __typename: 'PaymentSchedule' }
    & Pick<AdminTypes.PaymentSchedule, 'id'>
  ) | (
    { __typename: 'PaymentTerms' }
    & Pick<AdminTypes.PaymentTerms, 'id'>
  ) | (
    { __typename: 'PaymentTermsTemplate' }
    & Pick<AdminTypes.PaymentTermsTemplate, 'id'>
  ) | (
    { __typename: 'PointOfSaleDevice' }
    & Pick<AdminTypes.PointOfSaleDevice, 'id'>
  ) | (
    { __typename: 'PriceList' }
    & Pick<AdminTypes.PriceList, 'id'>
  ) | (
    { __typename: 'PriceRule' }
    & Pick<AdminTypes.PriceRule, 'id'>
  ) | (
    { __typename: 'PriceRuleDiscountCode' }
    & Pick<AdminTypes.PriceRuleDiscountCode, 'id'>
  ) | (
    { __typename: 'Product' }
    & Pick<AdminTypes.Product, 'id'>
  ) | (
    { __typename: 'ProductBundleOperation' }
    & Pick<AdminTypes.ProductBundleOperation, 'id'>
  ) | (
    { __typename: 'ProductDeleteOperation' }
    & Pick<AdminTypes.ProductDeleteOperation, 'id'>
  ) | (
    { __typename: 'ProductDuplicateOperation' }
    & Pick<AdminTypes.ProductDuplicateOperation, 'id'>
  ) | (
    { __typename: 'ProductFeed' }
    & Pick<AdminTypes.ProductFeed, 'id'>
  ) | (
    { __typename: 'ProductOption' }
    & Pick<AdminTypes.ProductOption, 'id'>
  ) | (
    { __typename: 'ProductOptionValue' }
    & Pick<AdminTypes.ProductOptionValue, 'id'>
  ) | (
    { __typename: 'ProductSetOperation' }
    & Pick<AdminTypes.ProductSetOperation, 'id'>
  ) | (
    { __typename: 'ProductTaxonomyNode' }
    & Pick<AdminTypes.ProductTaxonomyNode, 'id'>
  ) | (
    { __typename: 'ProductVariant' }
    & Pick<AdminTypes.ProductVariant, 'id'>
  ) | (
    { __typename: 'ProductVariantComponent' }
    & Pick<AdminTypes.ProductVariantComponent, 'id'>
  ) | (
    { __typename: 'Publication' }
    & Pick<AdminTypes.Publication, 'id'>
  ) | (
    { __typename: 'PublicationResourceOperation' }
    & Pick<AdminTypes.PublicationResourceOperation, 'id'>
  ) | (
    { __typename: 'QuantityPriceBreak' }
    & Pick<AdminTypes.QuantityPriceBreak, 'id'>
  ) | (
    { __typename: 'Refund' }
    & Pick<AdminTypes.Refund, 'id'>
  ) | (
    { __typename: 'RefundShippingLine' }
    & Pick<AdminTypes.RefundShippingLine, 'id'>
  ) | (
    { __typename: 'Return' }
    & Pick<AdminTypes.Return, 'id'>
  ) | (
    { __typename: 'ReturnLineItem' }
    & Pick<AdminTypes.ReturnLineItem, 'id'>
  ) | (
    { __typename: 'ReturnableFulfillment' }
    & Pick<AdminTypes.ReturnableFulfillment, 'id'>
  ) | (
    { __typename: 'ReverseDelivery' }
    & Pick<AdminTypes.ReverseDelivery, 'id'>
  ) | (
    { __typename: 'ReverseDeliveryLineItem' }
    & Pick<AdminTypes.ReverseDeliveryLineItem, 'id'>
  ) | (
    { __typename: 'ReverseFulfillmentOrder' }
    & Pick<AdminTypes.ReverseFulfillmentOrder, 'id'>
  ) | (
    { __typename: 'ReverseFulfillmentOrderDisposition' }
    & Pick<AdminTypes.ReverseFulfillmentOrderDisposition, 'id'>
  ) | (
    { __typename: 'ReverseFulfillmentOrderLineItem' }
    & Pick<AdminTypes.ReverseFulfillmentOrderLineItem, 'id'>
  ) | (
    { __typename: 'SaleAdditionalFee' }
    & Pick<AdminTypes.SaleAdditionalFee, 'id'>
  ) | (
    { __typename: 'SavedSearch' }
    & Pick<AdminTypes.SavedSearch, 'id'>
  ) | (
    { __typename: 'ScriptTag' }
    & Pick<AdminTypes.ScriptTag, 'id'>
  ) | (
    { __typename: 'Segment' }
    & Pick<AdminTypes.Segment, 'id'>
  ) | (
    { __typename: 'SellingPlan' }
    & Pick<AdminTypes.SellingPlan, 'id'>
  ) | (
    { __typename: 'SellingPlanGroup' }
    & Pick<AdminTypes.SellingPlanGroup, 'id'>
  ) | (
    { __typename: 'ServerPixel' }
    & Pick<AdminTypes.ServerPixel, 'id'>
  ) | (
    { __typename: 'Shop' }
    & Pick<AdminTypes.Shop, 'id'>
  ) | (
    { __typename: 'ShopAddress' }
    & Pick<AdminTypes.ShopAddress, 'id'>
  ) | (
    { __typename: 'ShopPolicy' }
    & Pick<AdminTypes.ShopPolicy, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsAccount' }
    & Pick<AdminTypes.ShopifyPaymentsAccount, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsBalanceTransaction' }
    & Pick<AdminTypes.ShopifyPaymentsBalanceTransaction, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsBankAccount' }
    & Pick<AdminTypes.ShopifyPaymentsBankAccount, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsDispute' }
    & Pick<AdminTypes.ShopifyPaymentsDispute, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsDisputeEvidence' }
    & Pick<AdminTypes.ShopifyPaymentsDisputeEvidence, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsDisputeFileUpload' }
    & Pick<AdminTypes.ShopifyPaymentsDisputeFileUpload, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsDisputeFulfillment' }
    & Pick<AdminTypes.ShopifyPaymentsDisputeFulfillment, 'id'>
  ) | (
    { __typename: 'ShopifyPaymentsPayout' }
    & Pick<AdminTypes.ShopifyPaymentsPayout, 'id'>
  ) | (
    { __typename: 'StaffMember' }
    & Pick<AdminTypes.StaffMember, 'id'>
  ) | (
    { __typename: 'StandardMetafieldDefinitionTemplate' }
    & Pick<AdminTypes.StandardMetafieldDefinitionTemplate, 'id'>
  ) | (
    { __typename: 'StoreCreditAccount' }
    & Pick<AdminTypes.StoreCreditAccount, 'id'>
  ) | (
    { __typename: 'StoreCreditAccountCreditTransaction' }
    & Pick<AdminTypes.StoreCreditAccountCreditTransaction, 'id'>
  ) | (
    { __typename: 'StoreCreditAccountDebitRevertTransaction' }
    & Pick<AdminTypes.StoreCreditAccountDebitRevertTransaction, 'id'>
  ) | (
    { __typename: 'StoreCreditAccountDebitTransaction' }
    & Pick<AdminTypes.StoreCreditAccountDebitTransaction, 'id'>
  ) | (
    { __typename: 'StorefrontAccessToken' }
    & Pick<AdminTypes.StorefrontAccessToken, 'id'>
  ) | (
    { __typename: 'SubscriptionBillingAttempt' }
    & Pick<AdminTypes.SubscriptionBillingAttempt, 'id'>
  ) | (
    { __typename: 'SubscriptionContract' }
    & Pick<AdminTypes.SubscriptionContract, 'id'>
  ) | (
    { __typename: 'SubscriptionDraft' }
    & Pick<AdminTypes.SubscriptionDraft, 'id'>
  ) | (
    { __typename: 'TaxonomyAttribute' }
    & Pick<AdminTypes.TaxonomyAttribute, 'id'>
  ) | (
    { __typename: 'TaxonomyCategory' }
    & Pick<AdminTypes.TaxonomyCategory, 'id'>
  ) | (
    { __typename: 'TaxonomyChoiceListAttribute' }
    & Pick<AdminTypes.TaxonomyChoiceListAttribute, 'id'>
  ) | (
    { __typename: 'TaxonomyMeasurementAttribute' }
    & Pick<AdminTypes.TaxonomyMeasurementAttribute, 'id'>
  ) | (
    { __typename: 'TaxonomyValue' }
    & Pick<AdminTypes.TaxonomyValue, 'id'>
  ) | (
    { __typename: 'TenderTransaction' }
    & Pick<AdminTypes.TenderTransaction, 'id'>
  ) | (
    { __typename: 'TransactionFee' }
    & Pick<AdminTypes.TransactionFee, 'id'>
  ) | (
    { __typename: 'UnverifiedReturnLineItem' }
    & Pick<AdminTypes.UnverifiedReturnLineItem, 'id'>
  ) | (
    { __typename: 'UrlRedirect' }
    & Pick<AdminTypes.UrlRedirect, 'id'>
  ) | (
    { __typename: 'UrlRedirectImport' }
    & Pick<AdminTypes.UrlRedirectImport, 'id'>
  ) | (
    { __typename: 'Validation' }
    & Pick<AdminTypes.Validation, 'id'>
  ) | (
    { __typename: 'Video' }
    & Pick<AdminTypes.Video, 'id'>
  ) | (
    { __typename: 'WebPixel' }
    & Pick<AdminTypes.WebPixel, 'id'>
  ) | (
    { __typename: 'WebhookSubscription' }
    & Pick<AdminTypes.WebhookSubscription, 'id'>
  )> };

export type ProductQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type ProductQuery = { product?: AdminTypes.Maybe<(
    Pick<AdminTypes.Product, 'id' | 'title' | 'vendor' | 'createdAt' | 'updatedAt' | 'status' | 'tracksInventory'>
    & { featuredMedia?: AdminTypes.Maybe<{ preview?: AdminTypes.Maybe<{ image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'id' | 'url'>> }> }>, variants: { edges: Array<Pick<AdminTypes.ProductVariantEdge, 'cursor'>>, nodes: Array<Pick<AdminTypes.ProductVariant, 'id' | 'title' | 'price' | 'createdAt' | 'updatedAt'>> } }
  )> };

export type ProductMediaQueryQueryVariables = AdminTypes.Exact<{
  query?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type ProductMediaQueryQuery = { files: { edges: Array<{ node: Pick<AdminTypes.ExternalVideo, 'createdAt' | 'updatedAt' | 'alt'> | (
        { __typename: 'GenericFile' }
        & Pick<AdminTypes.GenericFile, 'id' | 'url' | 'createdAt' | 'updatedAt' | 'alt'>
      ) | (
        { __typename: 'MediaImage' }
        & Pick<AdminTypes.MediaImage, 'id' | 'alt' | 'createdAt' | 'updatedAt'>
        & { image?: AdminTypes.Maybe<Pick<AdminTypes.Image, 'id' | 'url'>> }
      ) | Pick<AdminTypes.Model3d, 'createdAt' | 'updatedAt' | 'alt'> | (
        { __typename: 'Video' }
        & Pick<AdminTypes.Video, 'id' | 'createdAt' | 'updatedAt' | 'alt'>
      ) }> } };

interface GeneratedQueryTypes {
  "#graphql\n  query Order($id: ID!){\n    node(id: $id) {\n      id\n      __typename\n      ... on Order {\n        name\n        createdAt\n        updatedAt\n        cancelledAt\n        note\n        displayFinancialStatus\n        totalPriceSet {\n          shopMoney {\n            amount\n          }\n        }\n        risk {\n          assessments {\n            riskLevel\n          }\n        }\n        localizedFields(first: 5) {\n          nodes {\n            key\n            purpose\n            value \n          }\n        }\n        customer {\n          firstName\n          lastName\n          numberOfOrders\n          email\n          tags\n        }\n        app {\n          name\n        }\n        discountCodes\n        shippingLine {\n          title\n        }\n        shippingAddress {\n          address1\n          address2\n          city\n          country\n          countryCodeV2\n          firstName\n          lastName\n          phone\n          company\n          provinceCode\n          province\n          zip\n        }\n        displayFulfillmentStatus\n        lineItems(first: 25) {\n          nodes {\n            id\n            title\n            variantTitle\n            quantity\n            name\n            image {\n              url(transform: {maxHeight: 100, maxWidth: 100})\n            }\n            originalTotalSet {\n              shopMoney {\n                amount\n              }\n            }\n            vendor\n            unfulfilledQuantity\n            requiresShipping\n            nonFulfillableQuantity\n            variant {\n              id\n              inventoryItem {\n                measurement {\n                  weight {\n                    unit\n                    value\n                  }\n                }\n              }\n            }\n            product {\n              id\n              tracksInventory\n              productType\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: OrderQuery, variables: OrderQueryVariables},
  "#graphql\nquery Product($id: ID!) {\n  product(id: $id) {\n    id\n    title\n    vendor\n    createdAt\n    updatedAt\n    status\n    tracksInventory\n    featuredMedia {\n      preview {\n        image {\n          id\n          url\n        }\n      }\n    }\n    variants(first: 25) {\n      edges {\n        cursor\n      }\n      nodes {\n        id\n        title\n        price\n        createdAt\n        updatedAt\n      }\n    }\n  }\n}": {return: ProductQuery, variables: ProductQueryVariables},
  "#graphql\n  query ProductMediaQuery($query: String) {\n    files(first: 7, query: $query) {\n      edges {\n        node {\n          createdAt\n          updatedAt\n          alt\n          ... on GenericFile {\n            __typename\n            id\n            url\n          }\n          ... on MediaImage {\n            __typename\n            id\n            alt\n            image {\n              id\n              url(transform: {maxHeight: 750, maxWidth: 750})\n            }\n          }\n          ... on Video {\n            __typename\n            id\n          }\n        }\n      }\n    }\n  }\n": {return: ProductMediaQueryQuery, variables: ProductMediaQueryQueryVariables},
}

interface GeneratedMutationTypes {
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
