# MD for: https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-preferences/create-payment-preference.md

\> SERVER\_SIDE > > h1 > > Create and configure a payment preference A \*\*payment preference\*\* is an object or set of information that represents the product or service you want to charge for. Within the Mercado Pago ecosystem, this object is known as \`preference\`. When creating a payment preference, you can define essential details such as price, quantity, and payment methods, as well as other related configurations for the payment flow. During this step, you will also add the \*\*payment methods\*\* you want to offer with Checkout Pro, which by default includes all payment methods available in Mercado Pago. To create a payment preference, use the method associated with \`preference\` in the backend SDK. You need to \*\*create a payment preference for each order or payment flow\*\* you want to initiate. Below, you will find examples of how to implement this in your backend using the SDK, which is available in different programming languages. Complete the attributes with the appropriate information to reflect the details of each transaction and ensure an accurate payment flow. > NOTE > > You can adapt the Checkout Pro integration to your business model by configuring the attributes of the payment preference. These will allow you to define installments, exclude a payment method, change the expiration date of a specific payment, among other options. To customize your payment preference, access the documentation in the \*\*Additional settings\*\* section. 

php 

phpnodejavarubycsharppythongo

```
<?php
$client = new PreferenceClient();
$preference = $client->create([
  "items"=> array(
    array(
      "title" => "My product",
      "quantity" => 1,
      "unit_price" => 2000
    )
  )
]);

echo $preference
?>
```

```
const preference = new Preference(client);

preference.create({
  body: {
    items: [
      {
        title: 'My product',
        quantity: 1,
        unit_price: 2000
      }
    ],
  }
})
.then(console.log)
.catch(console.log);
```

```
PreferenceItemRequest itemRequest =
       PreferenceItemRequest.builder()
           .id("1234")
           .title("Games")
           .description("PS5")
           .pictureUrl("http://picture.com/PS5")
           .categoryId("games")
           .quantity(2)
           .currencyId("BRL")
           .unitPrice(new BigDecimal("4000"))
           .build();
   List<PreferenceItemRequest> items = new ArrayList<>();
   items.add(itemRequest);
PreferenceRequest preferenceRequest = PreferenceRequest.builder()
.items(items).build();
PreferenceClient client = new PreferenceClient();
Preference preference = client.create(preferenceRequest);
```

```
# Create a preference object
preference_data = {
  items: [
    {
      title: 'My product',
      unit_price: 75.56,
      quantity: 1
    }
  ]
}
preference_response = sdk.preference.create(preference_data)
preference = preference_response[:response]

# This value will replace the string "<%= @preference_id %>" in your HTML
@preference_id = preference['id']
```

```
// Create the preference request object
var request = new PreferenceRequest
{
    Items = new List<PreferenceItemRequest>
    {
        new PreferenceItemRequest
        {
            Title = "My product",
            Quantity = 1,
            CurrencyId = "ARS",
            UnitPrice = 75.56m,
        },
    },
};

// Create the preference using the client
var client = new PreferenceClient();
Preference preference = await client.CreateAsync(request);
```

```
# Create an item in the preference
preference_data = {
    "items": [
        {
            "title": "My product",
            "quantity": 1,
            "unit_price": 75.76,
        }
    ]
}

preference_response = sdk.preference().create(preference_data)
preference = preference_response["response"]
```

```
import (
  "github.com/mercadopago/sdk-go/pkg/preference"
)

client := preference.NewClient(cfg)

request := preference.Request{
	Items: []preference.ItemRequest{
		{
			Title:       "My product",
			Quantity:    1,
			UnitPrice:   75.76,
		},
	},
}

resource, err := client.Create(context.Background(), request)
if err != nil {
	fmt.Println(err)
	return
}

fmt.Println(resource)
```

\## Obtain the preference identifier The preference identifier is a unique transaction identifier for a specific payment request. To obtain it, you need to run your application. In the response, you will get the \*\*preference identifier\*\* in the \`ID\` property. \*\*Save this value as you will need it in the next step for your integration\*\* on a website or a mobile application. Below, we show an example of how the \`ID\` attribute with the preference identifier looks in a response. \`\`\` "id": "787997534-6dad21a1-6145-4f0d-ac21-66bf7a5e7a58" \`\`\` ### Choose the type of integration Once you have obtained your preference ID, you should proceed to the frontend configurations. To do this, you need to choose the type of integration that best suits your needs, whether it is for integrating a \*\*website\*\* or a \*\*mobile application\*\*. Select the type of integration you want to perform and follow the detailed steps to complete the Checkout Pro integration. 

# 

 Continue integration for websites 

 Offers payments with redirection to Mercado Pago on your website or online store. 

[ Web integration ]( /developers/en/docs/checkout-pro-preferences/configure-back-urls
)

 Continue integration for mobile applications 

 Offers payments with redirection to Mercado Pago in your mobile application. 

[ Mobile integration ]( /developers/en/docs/checkout-pro-preferences/mobile-integration
)