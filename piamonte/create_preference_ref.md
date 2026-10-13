# Create preference

Generate a preference with the information of a product or service and obtain the necessary URL to start the payment flow.

**POST** `/checkout/preferences`

## Request parameters

- `items` (array, optional)
  Items information.

  - `items[].id` (string, optional)
  Item ID.

  - `items[].title` (string, optional)
  This is the item`s title, which will display during the payment process, at checkout, activities, and emails.

  - `items[].description` (string, optional)
  Item description.

  - `items[].picture_url` (string, optional)
  Item image URL. Use of the HTTPS protocol is mandatory for this field. If a URL is submitted with the HTTP protocol, it is automatically discarded and the field returns empty. The image must be hosted at a publicly accessible address that doesn't require authentication.

  - `items[].category_id` (string, optional)
  This is a free string where the item category can be added. We suggest using one of the options shown in the following link https://api.mercadopago.com/item_categories.

  - `items[].quantity` (number, optional)
  Item quantity. This property is used to calculate the total cost.

  - `items[].currency_id` (string, optional)
  Unique ID to identify the currency. ISO_4217 code. Some sites allow local currency and USD, but it is important to note that the amount is converted to local currency when the preference is created, as the checkout always processes transactions using local currency. If you use USD please take into consideration that this value is not automatically updated if the value of local currency changes in relation to USD.

  - `items[].unit_price` (number, optional)
  Unit price of the item. This property is used together with the property quantity to determine the order cost. The field can contain two decimal places or none.

  - `items[].fiscal_data` (enum, optional)
  Presents the tax data of the item.
Possible enum values:

  - `sat`
  Provides the SAT (Authenticator and Transmitter System for Electronic Tax Receipts) category of the item.

  - `sat_measurement_id`
  Indicates whether the item is dangerous or not.

  - `measurement_unit`
  If the item is considered dangerous, specifies the type of the dangerous material.

  - `package_id`
  Identification of the package key.

  - `dangerous_material_idOP`
  Identification of the hazardous material key.

  - `items[].dimensions` (enum, optional)
  Presents the dimensions of the item to be shipped.
Possible enum values:

  - `unit`
  Unit of measure for the item.

  - `height`
  Height of the item.

  - `width`
  Item width.

  - `length`
  Item length.

  - `weight`
  Item weight.

- `payer` (object, optional)
  Payer's information, such as name, last name, e-mail, phone, personal identification, address, and registration date.

  - `payer.name` (string, optional)
  Payer name.

  - `payer.surname` (string, optional)
  Payer last name.

  - `payer.email` (string, optional)
  Payer e-mail address.

  - `payer.phone` (object, optional)
  Payer phone.

  - `payer.phone.area_code` (string, optional)
  Area code.

  - `payer.phone.number` (number, optional)
  Number.

  - `payer.identification` (object, optional)
  Payer's personal identification document. Providing this data helps strengthen fraud prevention for the transaction.

  - `payer.identification.type` (string, optional)
  Document type. Access the endpoint "/v1/identification_types" to check all available identification types by country and get a list with the details of each one and their properties. Values are case-sensitive, and depending on the site, an unrecognized value may not return an error, but instead be replaced with the site's default type.

  - `payer.identification.number` (string, optional)
  Payer's identification document number.

  - `payer.address` (object, optional)
  Payer's address.

  - `payer.address.zip_code` (string, optional)
  Zip code.

  - `payer.address.street_name` (string, optional)
  Street name.

  - `payer.address.street_number` (number, optional)
  Street number.

  - `payer.date_created` (string, optional)
  Registration date.

- `payment_methods` (object, optional)
  All configuration related to payments methods, such as excluded payment methods, excluded payment types, default payment method, and installments.

  - `payment_methods.excluded_payment_methods` (array, optional)
  Payment methods excluded from the payment process (except account_money and wallet, which is always allowed). The payment methods included here will not be available at checkout.

  - `payment_methods.excluded_payment_methods[].id` (string, optional)
  Payment method ID.

  - `payment_methods.excluded_payment_types` (array, optional)
  Payment types excluded from the payment process. The payment types included here will not be available at checkout.

  - `payment_methods.excluded_payment_types[].id` (string, optional)
  Payment method data_type ID.

  - `payment_methods.default_payment_method_id` (string, optional)
  Suggested payment method. The user will initiate the checkout with this payment method already selected. It is considered suggested because Checkouts follow different logics in order to select the best payment method for a specific transaction, and this property is the option with the least relevance.

  - `payment_methods.installments` (number, optional)
  Maximum number of credit card installments to be accepted.

  - `payment_methods.default_installments` (number, optional)
  Prefered number of credit card installments.

- `shipments` (object, optional)
  Shipments information.

  - `shipments.mode` (string, optional)
  Shipment mode.
Possible enum values:

  - `custom`
  Custom shipping. Not available for Checkout Pro or Payment link.

  - `me2`
  Mercado Envíos.

  - `not_specified`
  Shipping mode not specified.

  - `shipments.local_pickup` (boolean, optional)
  The payer has the option to pick up the shipment in your store (mode:me2 only).

  - `shipments.dimensions` (string, optional)
  Dimensions of the shipment in cm x cm x cm, gr (mode:me2 only).

  - `shipments.default_shipping_method` (number, optional)
  Select default shipping method in checkout (mode:me2 only).

  - `shipments.free_methods` (array, optional)
  Offer a shipping method as free shipping (mode:me2 only).

  - `shipments.free_methods[].id` (number, optional)
  Shipping method ID.

  - `shipments.cost` (number, optional)
  Shipment cost (mode:custom only).

  - `shipments.free_shipping` (boolean, optional)
  Free shipping for mode:custom.

  - `shipments.receiver_address` (object, optional)
  Shipping address.

  - `shipments.receiver_address.zip_code` (string, optional)
  Zip code.

  - `shipments.receiver_address.street_name` (string, optional)
  Street name.

  - `shipments.receiver_address.city_name` (string, optional)
  City name.

  - `shipments.receiver_address.state_name` (string, optional)
  State name.

  - `shipments.receiver_address.street_number` (number, optional)
  Street number.

  - `shipments.receiver_address.floor` (string, optional)
  Floor.

  - `shipments.receiver_address.apartment` (string, optional)
  Apartment.

  - `shipments.receiver_address.country_name` (string, optional)
  Country name.

- `back_urls` (object, optional)
  Return URLs to the seller's site, either automatically ("auto_return") or through the 'Return to site' button, depending on the payment status. The use of the protocol ("https") in the URL is mandatory. URLs with HTTP protocol (without "s") are automatically discarded by the API, that passes to consider the field as empty. In these cases, the redirection will be made by default to the predetermined pages.

  - `back_urls.success` (string, optional)
  Approved payment URL.

  - `back_urls.pending` (string, optional)
  Pending or in process payment URL.

  - `back_urls.failure` (string, optional)
  Canceled payment URL.

- `notification_url` (string, optional)
  Notifications URL available to receive notifications of events related to Payment. The maximum number of characters allowed for submission in this parameter is 248 characters. The use of the protocol ("https") in the URL is mandatory. Important: this URL is not validated by the systems, therefore it is the integrator's responsibility to ensure its validity (format, accessibility, and availability) to avoid failures in sending and receiving notifications.

- `statement_descriptor` (string, optional)
  The statement descriptor is a long text (up to 13 characters) that will be visualized in the payer´s credit card statement to easily identify the purchase.

- `additional_info` (string, optional)
  Additional information.

- `auto_return` (String, optional)
  If specified, the buyer will be automatically redirected to the seller's site after the purchase is approved with a credit card.
Possible enum values:

  - `approved`
  The redirection takes place only for approved payments with a credit card.

  - `all`
  The redirection takes place only for approved payments with a credit card, forward compatibility only if we change the default behavior.

- `external_reference` (string, optional)
  Reference you can synchronize with your payment system. Important: This field must be a maximum of 64 characters and may only contain numbers, letters, hyphens (-), and underscores (_). Special characters such as ([ ], (), '', @) are not allowed.

- `expires` (boolean, optional)
  Boolean value that determines if a preference expires.

- `expiration_date_from` (string, optional)
  Date in "yyyy-MM-dd'T'HH:mm:ssz" format which indicates the start of the preference`s validity period. This can be used, for instance, for limited sales, where sellers make an offer between certain dates. For example - 2022-11-17T09:37:52.000-04:00.

- `expiration_date_to` (string, optional)
  Date in "yyyy-MM-dd'T'HH:mm:ssz" format which indicates the end of the preference`s validity period. This can be used, for instance, for limited sales, where sellers make an offer between certain dates. For example - 2022-11-17T09:37:52.000-04:00.

- `marketplace` (string, optional)
  Origin of the payment. This is an alphanumeric field whose default value is NONE. If the collector has their own marketplace, this is where the credentials to identify it are sent. As the marketplace is associated to the Application ID, the marketplace credentials must correspond to the credentials used to create the preference. Using the wrong credentials will result in an error.

- `marketplace_fee` (number, optional)
  Marketplace's fee charged by application owner. It is a fixed amount and its default value is 0 in local currency. This property can only be sent if a valid marketplace has been defined as well, otherwise the request will fail.

- `differential_pricing` (object, optional)
  Differential pricing configuration for this preference. The seller can have their own configuration regarding payment methods and installments, and it`s in this parameter where they will include the numeric ID to indicate so. This value is used to apply custom payment methods.

  - `differential_pricing.id` (number, optional)
  Differential pricing ID.

- `tracks` (array, optional)
  Tracks to be executed during the users's interaction in the Checkout flow. The user can configure their own tracks. We currently supoort google and facebook. The collector must send the pixel ID (from google or facebook), and when the transaction flow is finalized the seller will be notified of the sale.

  - `tracks[].type` (string, optional)
  Track type. Specifies which tool the values belong to.
Possible enum values:

  - `google_ad`
  Allows configurations for GTM's Google Ads Conversion Tracking tag. Necessary values as conversion_id and conversion_label.

  - `facebook_ad`
  Allows configurations for Facebook Pixel. Necessary values as pixel_id.

  - `tracks[].values` (object, optional)
  Configuration values according to the type of track. For tracks of type 'google_ad,' configure the values for 'conversion_id' and 'conversion_label'. For tracks of type 'facebook_ad,' configure the value for 'pixel_id'.

  - `tracks[].values.conversion_id` (number, optional)
  Conversion ID.

  - `tracks[].values.conversion_label` (string, optional)
  Conversion label.

  - `tracks[].values.pixel_id` (string, optional)
  Facebook Pixel.

- `metadata` (object, optional)
  Valid JSON that can be added to the payment to save additional attributes.

## Response parameters

- `collector_id` (number, optional)
  Unique ID used to identify the collector. It is the same as the Cust ID.

- `operation_type` (String, optional)
  Operation data_type.
Possible enum values:

  - `regular_payment`
  Normal payment.

  - `money_transfer`
  Money request.

- `items` (array, optional)
  Items information.

  - `items[].id` (string, optional)
  Item ID.

  - `items[].picture_url` (string, optional)
  Item image URL. Use of the HTTPS protocol is mandatory for this field. If a URL is submitted with the HTTP protocol, it is automatically discarded and the field returns empty. The image must be hosted at a publicly accessible address that doesn't require authentication.

  - `items[].title` (string, optional)
  This is the item`s title, which will display during the payment process, at checkout, activities, and emails. To learn how to create a good title, check out the article: https://bit.ly/4dJmU89.

  - `items[].description` (string, optional)
  Item description. This is a free text field.

  - `items[].category_id` (string, optional)
  This is a free string where the item category can be added.

  - `items[].currency_id` (string, optional)
  Unique ID to identify the currency. ISO_4217 code. Some sites allow local currency and USD, but it is important to note that the amount is converted to local currency when the preference is created, as the checkout always processes transactions using local currency. If you use USD please take into consideration that this value is not automatically updated if the value of local currency changes in relation to USD.

  - `items[].quantity` (number, optional)
  Item quantity. This property is used to calculate the total cost.

  - `items[].unit_price` (number, optional)
  Unit price of the item. This property is used together with the property quantity to determine the order cost.

  - `items[].fiscal_data` (enum, optional)
  Presents the tax data of the item.
Possible enum values:

  - `sat`
  Provides the SAT (Authenticator and Transmitter System for Electronic Tax Receipts) category of the item.

  - `sat_measurement_id`
  Indicates whether the item is dangerous or not.

  - `measurement_unit`
  If the item is considered dangerous, specifies the type of the dangerous material.

  - `package_id`
  Identification of the package key.

  - `dangerous_material_idOP`
  Identification of the hazardous material key.

  - `items[].dimensions` (enum, optional)
  Presents the dimensions of the item to be shipped.
Possible enum values:

  - `unit`
  Unit of measure for the item.

  - `height`
  Height of the item.

  - `width`
  Ancho del artículo.

  - `length`
  Item length.

  - `weight`
  Item weight.

- `payer` (object, optional)
  Payer's information, such as name, last name, e-mail, phone, personal identification, address, and registration date.

  - `payer.name` (string, optional)
  Name of the associated payer.

  - `payer.surname` (string, optional)
  Last name of the associated payer.

  - `payer.email` (string, optional)
  Payer's email address.

  - `payer.date_created` (string, optional)
  Registration date.

  - `payer.phone` (object, optional)
  Phone number of the associated payer.

  - `payer.phone.area_code` (string, optional)
  Area code.

  - `payer.phone.number` (number, optional)
  Phone number.

  - `payer.identification` (object, optional)
  Identification of the payer.

  - `payer.identification.type` (string, optional)
  Type of identification of the associated payer (required if the payer is a customer).

  - `payer.identification.number` (string, optional)
  Identification number.

  - `payer.address` (object, optional)
  Payer's address.

  - `payer.address.street_name` (string, optional)
  Street name.

  - `payer.address.street_number` (string, optional)
  Street number.

  - `payer.address.zip_code` (string, optional)
  Zip code.

- `back_urls` (object, optional)
  Return URLs to the seller's site, either automatically ("auto_return") or through the 'Return to site' button, depending on the payment status. The use of the protocol ("https") in the URL is mandatory. URLs with HTTP protocol (without "s") are automatically discarded by the API, that passes to consider the field as empty. In these cases, the redirection will be made by default to the predetermined pages.

  - `back_urls.success` (string, optional)
  Approved payment URL.

  - `back_urls.pending` (string, optional)
  Pending or in process payment URL.

  - `back_urls.failure` (string, optional)
  Canceled payment URL.

- `auto_return` (String, optional)
  If specified, the buyer will be automatically redirected to the seller's site after the purchase is approved with a credit card.
Possible enum values:

  - `approved`
  The redirection takes place only for approved payments with a credit card.

  - `all`
  The redirection takes place only for approved payments with a credit card, forward compatibility only if we change the default behavior.

- `payment_methods` (object, optional)
  All configuration related to payments methods, such as excluded payment methods, excluded payment types, default payment method, and installments.

  - `payment_methods.excluded_payment_methods` (array, optional)
  Payment methods excluded from the payment process (except account_money, which is always allowed). The payment methods included here will not be available at checkout.

  - `payment_methods.excluded_payment_methods[].id` (string, optional)
  Payment method identifier.

  - `payment_methods.excluded_payment_types` (array, optional)
  Payment types excluded from the payment process. The payment types included here will not be available at checkout.

  - `payment_methods.excluded_payment_types[].id` (string, optional)
  Payment type identifier.

  - `payment_methods.installments` (string, optional)
  Maximum number of credit card installments to be accepted.

  - `payment_methods.default_payment_method_id` (string, optional)
  Suggested payment method. The user will initiate the checkout this this payment method already selected. It is considered suggested because Checkouts follow different logics in order to select the best payment method for a specific transaction, and this property is the option with the least relevance.

  - `payment_methods.default_installments` (string, optional)
  Prefered number of credit card installments.

- `binary_mode` (boolean, optional)
  When set to TRUE, payments can only be approved or rejected. Otherwise they can also result in_process.

- `client_id` (string, optional)
  Unique ID used to identify the client. It is obtained from the credentials used to create the preference. It's the application ID.

- `marketplace` (string, optional)
  Origin of the payment. This is an alphanumeric field whose default value is NONE. If the collector has their own marketplace, this is where the credentials to identify it are sent. As the marketplace is associated to the Application ID, the marketplace credentials must correspond to the credentials used to create the preference. Using the wrong credentials will result in an error.

- `marketplace_fee` (number, optional)
  Marketplace's fee charged by application owner. It is a fixed amount and its default value is 0 in local currency. This property can only be sent if a valid marketplace has been defined as well, otherwise the request will fail.

- `shipments` (object, optional)
  Shipments information.

  - `shipments.receiver_address` (object, optional)
  Shipping address.

  - `shipments.receiver_address.zip_code` (string, optional)
  Zip code.

  - `shipments.receiver_address.street_name` (string, optional)
  Street name.

  - `shipments.receiver_address.city_name` (string, optional)
  City name.

  - `shipments.receiver_address.state_name` (string, optional)
  State name.

  - `shipments.receiver_address.street_number` (number, optional)
  Street number.

  - `shipments.receiver_address.floor` (string, optional)
  Floor.

  - `shipments.receiver_address.apartment` (string, optional)
  Apartment.

  - `shipments.receiver_address.country_name` (string, optional)
  Country name.

- `notification_url` (string, optional)
  Notifications URL available to receive notifications of events related to Payment. The maximum number of characters allowed for submission in this parameter is 248 characters. The use of the protocol ("https") in the URL is mandatory.

- `statement_descriptor` (string, optional)
  The statement descriptor is a long text (up to 13 characters) that will be visualized in the payer´s credit card statement to easily identify the purchase.

- `external_reference` (string, optional)
  Reference you can synchronize with your payment system.

- `additional_info` (string, optional)
  Additional information.

- `expires` (boolean, optional)
  Boolean value that determines if a preference expires.

- `expiration_date_from` (string, optional)
  Date in "yyyy-MM-dd'T'HH:mm:ssz" format which indicates the start of the preference`s validity period. This can be used, for instance, for limited sales, where sellers make an offer between certain dates. For example - 2022-11-17T09:37:52.000-04:00.

- `expiration_date_to` (string, optional)
  Date in "yyyy-MM-dd'T'HH:mm:ssz" format which indicates the end of the preference`s validity period. This can be used, for instance, for limited sales, where sellers make an offer between certain dates. For example - 2022-11-17T09:37:52.000-04:00.

- `date_created` (string, optional)
  Registration date.

- `id` (string, optional)
  Autogenerated unique ID that identifies the preference. For example 036151801-2484cd71-7140-4c51-985a-d4cfcf133baf.

- `init_point` (string, optional)
  Automatically generated URL to open the Checkout.

- `preference_expired` (boolean, optional)
  Boolean value that determines whether a preference has already expired or is still active. If true, the preference has expired. If false, the preference is still active.

- `sandbox_init_point` (string, optional)
  Do not use this parameter. For integration testing, use init_point.

- `metadata` (object, optional)
  Valid JSON that can be added to the payment to save additional attributes.

## Errors

| Status | Error | Description |
| ------- | ------- | ----------- |
| 400 | collector_does_not_comply_with_current_regulation | The seller's account ("collector_id") has pending identity validation and regulatory compliance requirements for this site. Resolve them before creating a new preference. |
| 400 | invalid_collector_id | collector_id invalid. |
| 400 | invalid_sponsor_id | sponsor_id is not an active user. |
| 400 | invalid_collector_email | collector is not collector_email owner. |
| 400 | invalid_operation_type | operation_type invalid. |
| 400 | invalid_expiration_date_to | expiration_date_to invalid. |
| 400 | invalid_date | invalid date of expiration. |
| 400 | invalid_expiration_date_from | expiration_date_from invalid. |
| 400 | invalid_items | unit_price invalid. |
| 400 | invalid_back_urls | back_urls invalid. Wrong format. |
| 400 | invalid_payment_methods | installments invalid. Should be a number between 1 and 36. |
| 400 | invalid_marketplace_fee | marketplace_fee must not be greater than total amount. |
| 400 | invalid_id | preference_id not found. |
| 400 | invalid_access_token | access denied. |
| 400 | invalid_shipments | invalid type (<type>) for field shipments.cost. |
| 400 | invalid_binary_mode | binary_mode must be boolean. |
| 400 | sponsor_id site must be the same as collector_id | The sponsor_id site must be the same as the collector_id site. |

## Request example

### cURL

```bash
curl -X POST \
  'https://api.mercadopago.com/checkout/preferences' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -d '{
  "items": [
  {
  "id": "Sound system",
  "title": "Dummy Title",
  "description": "Dummy description",
  "picture_url": "https://www.myapp.com/myimage.jpg",
  "category_id": "car_electronics",
  "quantity": 1,
  "currency_id": "UYU",
  "unit_price": "24.50",
  "fiscal_data": "sat",
  "dimensions": "unit"
  }
  ],
  "payer": {
  "name": "Valentina",
  "surname": "Martínez",
  "email": "test@testuser.com",
  "phone": {
  "area_code": "2",
  "number": "1234-5678"
  },
  "identification": {
  "type": "CI",
  "number": "12345678"
  },
  "address": {
  "zip_code": "11300",
  "street_name": "Example Street",
  "street_number": "1294"
  },
  "date_created": "2024-04-01T00:00:00Z"
  },
  "payment_methods": {
  "excluded_payment_methods": [
  {
  "id": "master"
  }
  ],
  "excluded_payment_types": [
  {
  "id": "ticket"
  }
  ],
  "default_payment_method_id": "master",
  "installments": 10,
  "default_installments": 5
  },
  "shipments": {
  "mode": "custom",
  "local_pickup": true,
  "dimensions": "32 x 25 x 16",
  "default_shipping_method": 0,
  "free_methods": [
  {
  "id": 0
  }
  ],
  "cost": 20,
  "free_shipping": false,
  "receiver_address": {
  "zip_code": "11300",
  "street_name": "Street address test",
  "city_name": "Montevideo",
  "state_name": "Montevideo",
  "street_number": "1294",
  "floor": "string",
  "apartment": "string",
  "country_name": "Uruguay"
  }
  },
  "back_urls": {
  "success": "https://test.com/success",
  "pending": "https://test.com/pending",
  "failure": "https://test.com/failure"
  },
  "notification_url": "https://notificationurl.com",
  "statement_descriptor": "string",
  "additional_info": "Discount 12.00",
  "auto_return": "approved",
  "external_reference": "1643827245",
  "expires": true,
  "expiration_date_from": "2022-11-17T09:37:52.000-04:00",
  "expiration_date_to": "2022-11-17T10:37:52.000-05:00",
  "marketplace": "NONE",
  "marketplace_fee": 0,
  "differential_pricing": {
  "id": 1
  },
  "tracks": [
  {
  "type": "google_ad",
  "values": {
  "conversion_id": "123",
  "conversion_label": "abc",
  "pixel_id": "abc"
  }
  }
  ],
  "metadata": {}
  }'
```

### Node.js

```javascript
const client = new MercadoPago({ accessToken: config.access_token });
const preference = new Preference(client);

const body = {
  items: [
  {
  id: '1234',
  title: 'Dummy Title',
  description: 'Dummy description',
  picture_url: 'https://www.myapp.com/myimage.jpg',
  category_id: 'car_electronics',
  quantity: 1,
  currency_id: 'BRL',
  unit_price: 10,
  },
  ],
  marketplace_fee: 0,
  payer: {
  name: 'Test',
  surname: 'User',
  email: 'your_test_email@example.com',
  phone: {
  area_code: '11',
  number: '4444-4444',
  },
  identification: {
  type: 'CPF',
  number: '19119119100',
  },
  address: {
  zip_code: '06233200',
  street_name: 'Street',
  street_number: 123,
  },
  },
  back_urls: {
  success: 'https://test.com/success',
  failure: 'https://test.com/failure',
  pending: 'https://test.com/pending',
  },
  differential_pricing: {
  id: 1,
  },
  expires: false,
  additional_info: 'Discount: 12.00',
  auto_return: 'all',
  binary_mode: true,
  external_reference: '1643827245',
  marketplace: 'marketplace',
  notification_url: 'https://notificationurl.com',
  operation_type: 'regular_payment',
  payment_methods: {
  default_payment_method_id: 'master',
  excluded_payment_types: [
  {
  id: 'ticket',
  },
  ],
  excluded_payment_methods: [
  {
  id: '',
  },
  ],
  installments: 5,
  default_installments: 1,
  },
  shipments: {
  mode: 'custom',
  local_pickup: false,
  default_shipping_method: null,
  free_methods: [
  {
  id: 1,
  },
  ],
  cost: 10,
  free_shipping: false,
  dimensions: '10x10x20,500',
  receiver_address: {
  zip_code: '06000000',
  street_number: 123,
  street_name: 'Street',
  floor: '12',
  apartment: '120A',
  },
  },
  statement_descriptor: 'Test Store',
};

const response = await preference.create({ body })
  .then(console.log).catch(console.log);

```

### PHP

```php
<?php
MercadoPagoConfig::setAccessToken("ACCESS_TOKEN");

$client = new PreferenceClient();
$preference = $client->create([
"back_urls"=>array(
  "success" => "https://test.com/success",
  "failure" => "https://test.com/failure",
  "pending" => "https://test.com/pending"
),
"differential_pricing" => array(
  "id" => 1,
),
"expires" => false,
"items" => array(
  array(
  "id" => "1234",
  "title" => "Dummy Title",
  "description" => "Dummy description",
  "picture_url" => "https://www.myapp.com/myimage.jpg",
  "category_id" => "car_electronics",
  "quantity" => 2,
  "currency_id" => "BRL",
  "unit_price" => 100
  )
),
"marketplace_fee" => 0,
"payer" => array(
  "name" => "Test",
  "surname" => "User",
  "email" => "your_test_email@example.com",
  "phone" => array(
  "area_code" => "11",
  "number" => "4444-4444"
  ),
  "identification" => array(
  "type" => "CPF",
  "number" => "19119119100"
  ),
  "address" => array(
  "zip_code" => "06233200",
  "street_name" => "Street",
  "street_number" => "123"
  )
),
"additional_info" => "Discount: 12.00",
"auto_return" => "all",
"binary_mode" => true,
"external_reference" => "1643827245",
"marketplace" => "none",
"notification_url" => "https://notificationurl.com",
"operation_type" => "regular_payment",
"payment_methods" => array(
  "default_payment_method_id" => "master",
  "excluded_payment_types" => array(
  array(
  "id" => "visa"
  )
  ),
  "excluded_payment_methods" => array(
  array(
  "id" => ""
  )
  ),
  "installments" => 5,
  "default_installments" => 1
),
"shipments" >= array(
  "mode" => "custom",
  "local_pickup" => false,
  "default_shipping_method" => null,
  "free_methods" => array(
  array(
  "id" => 1
  )
  ),
  "cost" => 10,
  "free_shipping" => false,
  "dimensions" => "10x10x20,500",
  "receiver_address" => array(
  "zip_code" => "06000000",
  "street_number" => "123",
  "street_name" => "Street",
  "floor" => "12",
  "apartment" => "120A",
  "city_name" => "Rio de Janeiro",
  "state_name" => "Rio de Janeiro",
  "country_name" => "Brasil"
  )
),
"statement_descriptor" => "Test Store",
]);

echo implode($preference);
?>
```

### Python

```python
import mercadopago
sdk = mercadopago.SDK("PROD_ACCESS_TOKEN")

request = {
	"items": [
		{
			"id": "1234",
			"title": "Dummy Title",
			"description": "Dummy description",
			"picture_url": "https://www.myapp.com/myimage.jpg",
			"category_id": "car_electronics",
			"quantity": 1,
			"currency_id": "BRL",
			"unit_price": 10,
		},
	],
	"marketplace_fee": 0,
	"payer": {
		"name": "Test",
		"surname": "User",
		"email": "your_test_email@example.com",
		"phone": {
			"area_code": "11",
			"number": "4444-4444",
		},
		"identification": {
			"type": "CPF",
			"number": "19119119100",
		},
		"address": {
			"zip_code": "06233200",
			"street_name": "Street",
			"street_number": 123,
		},
	},
	"back_urls": {
		"success": "https://test.com/success",
		"failure": "https://test.com/failure",
		"pending": "https://test.com/pending",
	},
	"differential_pricing": {
		"id": 1,
	},
	"expires": False,
	"additional_info": "Discount: 12.00",
	"auto_return": "all",
	"binary_mode": True,
	"external_reference": "1643827245",
	"marketplace": "marketplace",
	"notification_url": "https://notificationurl.com",
	"operation_type": "regular_payment",
	"payment_methods": {
		"default_payment_method_id": "master",
		"excluded_payment_types": [
			{
				"id": "ticket",
			},
		],
		"excluded_payment_methods": [
			{
				"id": "",
			},
		],
		"installments": 5,
		"default_installments": 1,
	},
	"shipments": {
		"mode": "custom",
		"local_pickup": False,
		"default_shipping_method": None,
		"free_methods": [
			{
				"id": 1,
			},
		],
		"cost": 10,
		"free_shipping": False,
		"dimensions": "10x10x20,500",
		"receiver_address": {
			"zip_code": "06000000",
			"street_number": 123,
			"street_name": "Street",
			"floor": "12",
			"apartment": "120A",
		},
	},
	"statement_descriptor": "Test Store",
}

preference_response = sdk.preference().create(request)
preference = preference_response["response"]
```

### Java

```java
MercadoPagoConfig.setAccessToken("YOUR_ACCESS_TOKEN");
PreferenceClient client = new PreferenceClient();

PreferenceItemRequest itemRequest =
  PreferenceItemRequest.builder()
  .id("1234")
  .title("Dummy Title")
  .description("Dummy description")
  .pictureUrl("https://www.myapp.com/myimage.jpg")
  .categoryId("car_electronics")
  .quantity(1)
  .currencyId("BRL")
  .unitPrice(new BigDecimal("10"))
  .build();

List<PreferenceItemRequest> items = new ArrayList<>();
items.add(itemRequest);

PreferenceFreeMethodRequest freeMethod =
  PreferenceFreeMethodRequest.builder()
  .id(1L).build();
List<PreferenceFreeMethodRequest> freeMethodList = new ArrayList<>();
freeMethodList.add(freeMethod);

List<PreferencePaymentTypeRequest> excludedPaymentTypes = new ArrayList<>();
excludedPaymentTypes.add(PreferencePaymentTypeRequest.builder().id("ticket").build());

List<PreferencePaymentMethodRequest> excludedPaymentMethods = new ArrayList<>();
excludedPaymentMethods.add(PreferencePaymentMethodRequest.builder().id("").build());

PreferenceRequest preferenceRequest = PreferenceRequest.builder()
  .backUrls(
  PreferenceBackUrlsRequest.builder()
  .success("https://test.com/success")
  .failure("https://test.com/failure")
  .pending("https://test.com/pending")
  .build())
  .differentialPricing(
  PreferenceDifferentialPricingRequest.builder()
  .id(1L)
  .build())
  .expires(false)
  .items(items)
  .marketplaceFee(new BigDecimal("0"))
  .payer(
  PreferencePayerRequest.builder()
  .name("Test")
  .surname("User")
  .email("your_test_email@example.com")
  .phone(PhoneRequest.builder().areaCode("11").number("4444-4444").build())
  .identification(
  IdentificationRequest.builder().type("CPF").number("19119119100").build())
  .address(
  AddressRequest.builder()
  .zipCode("06233200")
  .streetName("Street")
  .streetNumber("123")
  .build())
  .build())
  .additionalInfo("Discount: 12.00")
  .autoReturn("all")
  .binaryMode(true)
  .externalReference("1643827245")
  .marketplace("marketplace")
  .notificationUrl("https://notificationurl.com")
  .operationType("regular_payment")
  .paymentMethods(
  PreferencePaymentMethodsRequest.builder()
  .defaultPaymentMethodId("master")
  .excludedPaymentTypes(excludedPaymentTypes)
  .excludedPaymentMethods(excludedPaymentMethods)
  .installments(5)
  .defaultInstallments(1)
  .build())
  .shipments(
  PreferenceShipmentsRequest.builder()
  .mode("custom")
  .localPickup(false)
  .defaultShippingMethod(null)
  .freeMethods(freeMethodList)
  .cost(BigDecimal.TEN)
  .freeShipping(false)
  .dimensions("10x10x20,500")
  .receiverAddress(
  PreferenceReceiverAddressRequest.builder()
  .zipCode("06000000")
  .streetNumber("123")
  .streetName("Street")
  .floor("12")
  .apartment("120A")
  .build())
  .build())
  .statementDescriptor("Test Store")
  .build();

Preference preference = client.create(preferenceRequest);
```

### .Net

```csharp
MercadoPagoConfig.AccessToken = "PROD_ACCESS_TOKEN";
PreferenceRequest request = new PreferenceRequest
{
  BackUrls = new PreferenceBackUrlsRequest
  {
  Success = "https://test.com/success",
  Failure = "https://test.com/failure",
  Pending = "https://test.com/pending"
  },
  DifferentialPricing = new PreferenceDifferentialPricingRequest
  {
  Id = 1
  },
  Expires = false,
  Items = new List<PreferenceItemRequest>
  {
  new PreferenceItemRequest
  {
  Id = "1234",
  Title = "Dummy Title",
  Description = "Dummy description",
  PictureUrl = "https://www.myapp.com/myimage.jpg",
  CategoryId = "car_electronics",
  Quantity = 2,
  CurrencyId = "BRL",
  UnitPrice = 100
  }
  },
  MarketplaceFee = 0,
  Payer = new PreferencePayerRequest
  {
  Name = "Test",
  Surname = "User",
  Email = "your_test_email@example.com",
  Phone = new PhoneRequest
  {
  AreaCode = "11",
  Number = "4444-4444"
  },
  Identification = new IdentificationRequest
  {
  Type = "CPF",
  Number = "19119119100"
  },
  Address = new AddressRequest
  {
  ZipCode = "06233200",
  StreetName = "Street",
  StreetNumber = "123"
  }
  },
  AdditionalInfo = "Discount: 12.00",
  AutoReturn = "all",
  BinaryMode = true,
  ExternalReference = "1643827245",
  Marketplace = "none",
  NotificationUrl = "https://notificationurl.com",
  OperationType = "regular_payment",
  PaymentMethods = new PreferencePaymentMethodsRequest
  {
  DefaultPaymentMethodId = "master",
  ExcludedPaymentTypes = new List<PreferencePaymentTypeRequest>
  {
  new PreferencePaymentTypeRequest
  {
  Id = "visa"
  }
  },
  ExcludedPaymentMethods = new List<PreferencePaymentMethodRequest>
  {
  new PreferencePaymentMethodRequest
  {
  Id = ""
  }
  },
  Installments = 5,
  DefaultInstallments = 1
  },
  Shipments = new PreferenceShipmentsRequest
  {
  Mode = "custom",
  LocalPickup = false,
  FreeMethods = new List<PreferenceFreeMethodRequest>
  {
  new PreferenceFreeMethodRequest
  {
  Id = 1
  }
  },
  Cost = 10,
  FreeShipping = false,
  Dimensions = "10x10x20,500",
  ReceiverAddress = new PreferenceReceiverAddressRequest
  {
  ZipCode = "06000000",
  StreetNumber = "123",
  StreetName = "Street",
  Floor = "12",
  Apartment = "120A",
  City = "Rio de Janeiro",
  State = "Rio de Janeiro",
  Country = "Brasil"
  }
  },
  StatementDescriptor = "Test Store"
};
PreferenceClient client = new PreferenceClient();
Preference preference = client.Create(request);
```

### Ruby

```text
sdk = MercadoPago::Client.new('ACCESS_TOKEN')

request = {
  items: [
  {
  id: '1234',
  title: 'Dummy Title',
  description: 'Dummy description',
  picture_url: 'https://www.myapp.com/myimage.jpg',
  category_id: 'car_electronics',
  quantity: 1,
  currency_id: 'BRL',
  unit_price: 10,
  },
  ],
  marketplace_fee: 0,
  payer: {
  name: 'Test',
  surname: 'User',
  email: 'your_test_email@example.com',
  phone: {
  area_code: '11',
  number: '4444-4444',
  },
  identification: {
  type: 'CPF',
  number: '19119119100',
  },
  address: {
  zip_code: '06233200',
  street_name: 'Street',
  street_number: 123,
  },
  },
  back_urls: {
  success: 'https://test.com/success',
  failure: 'https://test.com/failure',
  pending: 'https://test.com/pending',
  },
  differential_pricing: {
  id: 1,
  },
  expires: false,
  additional_info: 'Discount: 12.00',
  auto_return: 'all',
  binary_mode: true,
  external_reference: '1643827245',
  marketplace: 'marketplace',
  notification_url: 'https://notificationurl.com',
  operation_type: 'regular_payment',
  payment_methods: {
  default_payment_method_id: 'master',
  excluded_payment_types: [
  {
  id: 'ticket',
  },
  ],
  excluded_payment_methods: [
  {
  id: '',
  },
  ],
  installments: 5,
  default_installments: 1,
  },
  shipments: {
  mode: 'custom',
  local_pickup: false,
  default_shipping_method: nil,
  free_methods: [
  {
  id: 1,
  },
  ],
  cost: 10,
  free_shipping: false,
  dimensions: '10x10x20,500',
  receiver_address: {
  zip_code: '06000000',
  street_number: 123,
  street_name: 'Street',
  floor: '12',
  apartment: '120A',
  },
  },
  statement_descriptor: 'Test Store',
}

preference_response = sdk.preference.create(request)
preference = preference_response[:response]
```

## Response example

```json
{
  "collector_id": 202809963,
  "operation_type": "regular_payment",
  "items": [
  {
  "id": "string",
  "picture_url": "string",
  "title": "Dummy Item",
  "description": "Multicolor Item",
  "category_id": "string",
  "currency_id": "UYU",
  "quantity": 1,
  "unit_price": "24.50",
  "fiscal_data": "sat",
  "dimensions": "unit"
  }
  ],
  "payer": {
  "name": "string",
  "surname": "string",
  "email": "test@testuser.com",
  "date_created": "string",
  "phone": {
  "area_code": "string",
  "number": 0
  },
  "identification": {
  "type": "CI",
  "number": "string"
  },
  "address": {
  "street_name": "string",
  "street_number": "string",
  "zip_code": "string"
  }
  },
  "back_urls": {
  "success": "https://test.com/success",
  "pending": "https://test.com/pending",
  "failure": "https://test.com/failure"
  },
  "auto_return": "approved",
  "payment_methods": {
  "excluded_payment_methods": [
  {
  "id": "string"
  }
  ],
  "excluded_payment_types": [
  {
  "id": "string"
  }
  ],
  "installments": "string",
  "default_payment_method_id": "string",
  "default_installments": "string"
  },
  "binary_mode": false,
  "client_id": "6295877106812064",
  "marketplace": "MP-MKT-6295877106812064",
  "marketplace_fee": 0,
  "shipments": {
  "receiver_address": {
  "zip_code": "string",
  "street_name": "string",
  "city_name": "string",
  "state_name": "string",
  "street_number": 0,
  "floor": "string",
  "apartment": "string",
  "country_name": "string"
  }
  },
  "notification_url": "https://notificationurl.com",
  "statement_descriptor": "MERCADOPAGO",
  "external_reference": "string",
  "additional_info": "string",
  "expires": false,
  "expiration_date_from": "2022-11-17T09:37:52.000-04:00",
  "expiration_date_to": "2022-11-17T10:37:52.000-05:00",
  "date_created": "2022-11-17T10:37:52.000-05:00",
  "id": "202809963-920c288b-4ebb-40be-966f-700250fa5370",
  "init_point": "https://www.mercadopago.com/mla/checkout/start?pref_id=202809963-920c288b-4ebb-40be-966f-700250fa5370",
  "preference_expired": true,
  "sandbox_init_point": "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=202809963-920c288b-4ebb-40be-966f-700250fa5370",
  "metadata": {}
}
```