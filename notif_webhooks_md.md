# MD for: https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks.md

\# Webhooks Webhooks (also known as web callbacks) are a simple method that allows an application or system to provide real-time information whenever an event occurs. It's a passive way of receiving data between two systems via an \`HTTP POST\` request. Webhooks notifications can be configured for each application created in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app). You can also configure a test URL that, along with your test credentials, allows you to test the correct operation of your notifications before going live. Once configured, the Webhook will be sent whenever one or more registered events occur, eliminating the need for constant checks and thus preventing system overload and data loss in critical situations. To configure your Webhooks notifications, choose one of the options below: | Configuration type | Description | |---|---| | \[Configuration through Your integrations\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks#bookmark\_configuration\_through\_your\_integrations) | Allows configuring notifications for each one of your applications, identifying different accounts if necessary, and validating the notification origin using the secret signature (except notifications for QR Code integrations). | | \[Configuration during payment creation\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks#bookmark\_configuration\_during\_payment\_creation) | Allows specific configuration of notifications for each payment, preference or order . | > WARNING > > Important > > The URLs configured during payment creation will take precedence over those configured through Your integrations. Once notifications are configured, refer to the necessary \[actions after receiving a notification\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks#bookmark\_necessary\_actions\_after\_receiving\_a\_notification) to validate that the notifications were properly received. ## Configuration through Your integrations Set up notifications for each application directly in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app) efficiently and securely. In this documentation, we will explain how: 1\. Specify URLs and configure events 2\. Validate the notification source 3\. Simulate receiving the notification > WARNING > > Important > > This configuration method is not available for QR Code or Subscriptions integrations. To set up notifications for either of these integrations, use the \[Configuration during payment creation\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks#bookmark\_configuration\_during\_payment\_creation) method. ### 1\. Specify URLs and configure events To configure Webhooks notifications via Your integrations, it is necessary to specify the URLs where they will be received and the events for which you wish to receive notifications. To do this, follow these steps: 1\. Access \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app) and select the application for which you want to enable notifications. If you haven't created an application yet, create one in \*\*Your integrations\*\*. 2\. In the left menu, click on \*\*Webhooks > Configure notifications\*\* and configure the URLs that will be used to receive notifications. We recommend using different URLs for testing mode and production mode: \* \*\*Test mode URL:\*\* provide a URL that allows testing the correct operation of notifications for this application during the testing or development phase. Testing these notifications should be done exclusively with the \*\*test credentials of productive users\*\*. \* \*\*Production mode URL:\*\* provide a URL to receive notifications with your productive integration. These notifications should be configured with \*\*productive credentials\*\*. !\[webhooks\](/images/dashboard/webhooks-es-v1.png) > NOTE > > Note > > If you need to identify multiple accounts, you can add the parameter \`?cliente=(sellersname)\` to the endpoint URL to identify the sellers. 3\. Select the \*\*events\*\* from which you want to receive notifications in \`JSON\` format via an \`HTTP POST\` to the URL specified earlier. An event can be any type of update on the reported object, including status changes or attributes. Refer to the table below to see the events that can be configured, considering the integrated Mercado Pago solution and its business specifics. | Events | Name in Your Integrations | Topic | Associated products | |---|---|---|---| | Creation and update of payments | Payments | \`payment\` | \[Checkout API\](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-orders/overview)  
\[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview)  
\[Checkout Bricks\](https://www.mercadopago.com.uy/developers/en/docs/checkout-bricks/overview)  
\[Subscriptions\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/overview)  
\[Wallet Connect\](https://www.mercadopago.com.uy/developers/en/docs/wallet-connect/landing) | | Creation and update of payments | Order (Mercado Pago) | \`orders\` | \[QR Code\](https://www.mercadopago.com.uy/developers/en/docs/qr-code/overview) | | Recurring payment of a subscription (creation - update) | Plans and Subscriptions | \`subscription\_authorized\_payment\` | \[Subscriptions\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/overview) | | Subscription linking (creation - update) | Plans and Subscriptions | \`subscription\_preapproval\` | \[Subscriptions\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/overview) | | Subscription plan linking (creation - update) | Plans and Subscriptions | \`subscription\_preapproval\_plan\` | \[Subscriptions\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/overview) | | Linking and unlinking of accounts connected via OAuth | Application linking | \`mp-connect\` | All products that have implemented OAuth | | Wallet Connect transactions | Wallet Connect | \`wallet\_connect\` | \[Wallet Connect\](https://www.mercadopago.com.uy/developers/en/docs/wallet-connect/landing) | | Fraud alerts after order processing | Fraud alerts | \`stop\_delivery\_op\_wh\` | \[Checkout API\](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-orders/overview)  
\[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview) | | Creation of refunds and claims | Claims | \`topic\_claims\_integration\_wh\` | \[Checkout API\](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-orders/overview)  
\[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview)  
\[Checkout Bricks\](https://www.mercadopago.com.uy/developers/en/docs/checkout-bricks/overview)  
\[Subscriptions\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/overview)  
\[QR Code\](https://www.mercadopago.com.uy/developers/en/docs/qr-code/overview)  
\[Wallet Connect\](https://www.mercadopago.com.uy/developers/en/docs/wallet-connect/landing) | | Retrieval of card information and update within Mercado Pago | Card Updater | \`topic\_card\_id\_wh\` | \[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview)  
\[Checkout API\](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-orders/overview)  
\[Checkout Bricks\](https://www.mercadopago.com.uy/developers/en/docs/checkout-bricks/overview) | | Creation, closure, or expiration of commercial orders | Commercial orders | \`topic\_merchant\_order\_wh\` | \[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview)  
\[QR Code\](https://www.mercadopago.com.uy/developers/en/docs/qr-code/overview) | | Opening of chargebacks, status changes, and modifications related to the release of funds | Chargebacks | \`topic\_chargebacks\_wh\` | \[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro/overview)  
\[Checkout API\](https://www.mercadopago.com.uy/developers/en/docs/checkout-api-orders/overview)  
\[Checkout Bricks\](https://www.mercadopago.com.uy/developers/en/docs/checkout-bricks/overview) | > WARNING > > Important > > If you have any questions about the topics to de activated or the events that will be notified, check the \[Additional information about Notifications documentation\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/additional-info). 4\. Finally, click on \*\*Save\*\*. This will generate a unique \*\*secret signature\*\* for your application, allowing you to validate the authenticity of received notifications, ensuring they were sent by Mercado Pago. Note that the generated signature does not have an expiration date, and its periodic renewal is not mandatory but highly recommended. Simply click the \*\*Reset\*\* button next to the signature to renew it. > WARNING > > Important > > QR Code notifications cannot be verified using the secret signature. Therefore, you should proceed directly to the Simulate receiving notifications step. If you have a QR Code integration and still want to verify the origin of your notifications, please contact \[Mercado Pago Support\](https://www.mercadopago.com.uy/developers/en/support/center). ### 2\. Validate notification origin Notifications sent by Mercado Pago will be similar to the following example for a \`payment\` topic alert: \`\`\`json { "id": 12345, "live\_mode": true, "type": "payment", "date\_created": "2015-03-25T10:04:58.396-04:00", "user\_id": 44444, "api\_version": "v1", "action": "payment.created", "data": { "id": "999999999" } } \`\`\` Mercado Pago will always include the secret signature in the Webhooks notifications received at the registered URL, which will allow you to validate their authenticity to provide greater security and prevent potential fraud. This signature will be sent in the \`x-signature\` header, as shown in the example below. \`\`\`x-signature \`ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839\` \`\`\` To confirm the validation, it is necessary to extract the key from the \_header\_ and compare it with the key provided for your application in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app). Follow one of the approaches below to validate the authenticity of the notification. ::::TabsComponent :::TabComponent{title="With SDKs"} The official SDK implements HMAC-based Webhook Signature Verification to authenticate the origin of each received notification. To get your secret key (\`secret\`), select the application in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app), click \*\*Webhooks > Configure notification\*\*, and reveal the generated key. 

php 

phpjavascriptpythongocsharpjavaruby

```
<?php
use MercadoPago\Webhook\WebhookSignatureValidator;
use MercadoPago\Exceptions\InvalidWebhookSignatureException;

try {
    WebhookSignatureValidator::validate(
        $_SERVER['HTTP_X_SIGNATURE'],
        $_SERVER['HTTP_X_REQUEST_ID'],
        $_GET['data_id'],
        $secret
    );
    http_response_code(200);
} catch (InvalidWebhookSignatureException $e) {
    http_response_code(401);
}
```

```
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago';

try {
    WebhookSignatureValidator.validate({
        xSignature: req.headers['x-signature'],
        xRequestId: req.headers['x-request-id'],
        dataId:     req.query['data.id'],
        secret,
    });
    res.sendStatus(200);
} catch (err) {
    if (err instanceof InvalidWebhookSignatureError) res.status(401).end();
    else throw err;
}
```

```
from mercadopago.webhook import WebhookSignatureValidator, InvalidWebhookSignatureError

try:
    WebhookSignatureValidator.validate(
        request.headers.get("x-signature"),
        request.headers.get("x-request-id"),
        request.args.get("data.id"),
        secret,
    )
    return "", 200
except InvalidWebhookSignatureError:
    return "", 401
```

```
import "github.com/mercadopago/sdk-go/pkg/webhook"

err := webhook.ValidateSignature(
    r.Header.Get("x-signature"),
    r.Header.Get("x-request-id"),
    r.URL.Query().Get("data.id"),
    secret,
)
if err != nil {
    w.WriteHeader(http.StatusUnauthorized)
    return
}
w.WriteHeader(http.StatusOK)
```

```
using MercadoPago.Error;
using MercadoPago.Webhook;

try {
    WebhookSignatureValidator.Validate(
        xSignature: Request.Headers["x-signature"],
        xRequestId: Request.Headers["x-request-id"],
        dataId:     Request.Query["data.id"],
        secret:     secret);
    return Ok();
} catch (InvalidWebhookSignatureException) {
    return Unauthorized();
}
```

```
import com.mercadopago.webhook.WebhookSignatureValidator;
import com.mercadopago.exceptions.MPInvalidWebhookSignatureException;

try {
    WebhookSignatureValidator.validate(
        request.getHeader("x-signature"),
        request.getHeader("x-request-id"),
        request.getParameter("data.id"),
        secret);
    response.setStatus(200);
} catch (MPInvalidWebhookSignatureException e) {
    response.setStatus(401);
}
```

```
require 'mercadopago/webhook/validator'

begin
    Mercadopago::Webhook::Validator.validate(
        request.headers['x-signature'],
        request.headers['x-request-id'],
        request.params['data.id'],
        secret
    )
    head :ok
rescue Mercadopago::Webhook::InvalidWebhookSignatureError
    head :unauthorized
end
```

::: :::TabComponent{title="Without SDKs"} 1\. To extract the \_timestamp\_ (\`ts\`) and key (\`v1\`) from the \`x-signature\` \_header\_, divide the \_header\_ content by the \`,\` character, which will result in a list of elements. The value for the \`ts\` prefix is the notification \_timestamp\_ (in milliseconds) and \`v1\` is the encrypted key. 2\. Using the \_template\_ below, substitute the parameters with the data received in your notification. \`\`\` id:\[data.id\_url\];request-id:\[x-request-id\_header\];ts:\[ts\_header\]; \`\`\` - \`\[data.id\_url\]\` will be replaced by the value of the \`data.id\` parameter received in the URL \_query params\_. > NOTE > > If \`data.id\` is returned with uppercase alphanumeric characters, convert it to lowercase before using it in the manifest. For example, \`ORD01JQ4S4KY8HWQ6NA5PXB65B3D3\` should be used as \`ord01jq4s4ky8hwq6na5pxb65b3d3\`. - \`\[x-request-id\_header\]\` must be replaced by the value received in the \`x-request-id\` \_header\_. - \`\[ts\_header\]\` will be the \`ts\` value extracted from the \`x-signature\` \_header\_. > NOTE > > If any of the values (\`data.id\`, \`x-request-id\`) are not present in the received notification, you must remove them from the manifest before computing the \`HMAC\`. 3\. In \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app), select the integrated application, click \*\*Webhooks > Configure notification\*\* and reveal the generated secret key. 4\. Generate the counter-key for validation. To do this, compute an \[HMAC\](https://en.wikipedia.org/wiki/HMAC) with the \`SHA256 hash\` function in hexadecimal base, using the secret key as the key and the \_template\_ with the values as the message. 

php 

phpnodejavapython

```
$cyphedSignature = hash_hmac('sha256', $data, $key);
```

```
const crypto = require('crypto');
const cyphedSignature = crypto
    .createHmac('sha256', secret)
    .update(signatureTemplateParsed)
    .digest('hex');
```

```
String cyphedSignature = new HmacUtils("HmacSHA256", secret).hmacHex(signedTemplate);
```

```
import hashlib, hmac, binascii

cyphedSignature = binascii.hexlify(hmac.new(secret.encode(), signedTemplate.encode(), hashlib.sha256).digest())
```

5\. Finally, compare the generated key with the key extracted from the \_header\_, ensuring they match exactly. Additionally, you can use the \_timestamp\_ extracted from the \_header\_ to compare it with a \_timestamp\_ generated at the time of receipt, in order to establish a delay tolerance in receiving the message. Here are complete code examples: 

php 

phpnodejavarubycsharppythongocurl

```
<?php 
$client = new PaymentClient();

        $body = [
            'transaction_amount' => 100,
            'token' => 'token',
            'description' => 'description',
            'installments' => 1,
            'payment_method_id' => 'visa',
            'notification_url' => 'http://test.com',
            'payer' => array(
                'email' => 'test_payer@example.com',
                'identification' => array(
                    'type' => 'CPF',
                    'number' => '19119119100'
                )
            )
        ];

$client->create(body);
?>
```

```
const client = new MercadoPagoConfig({ accessToken: 'ACCESS_TOKEN' });
const payment = new Payment(client);

const body = {
 transaction_amount: '100',
  token: 'token',
  description: 'description',
  installments: 1,
  payment_method_id: 'visa',
  notification_url: 'http://test.com',
  payer: {
    email: 'test_payer@example.com',
    identification: {
      type: 'CPF',
      number: '19119119100'
    }
  }
};

payment.create({ body: body, requestOptions: { idempotencyKey: '<SOME_UNIQUE_VALUE>' } }).then(console.log).catch(console.log);
```

```
MercadoPago.SDK.setAccessToken("YOUR_ACCESS_TOKEN");


Payment payment = new Payment();
payment.setTransactionAmount(Float.valueOf(request.getParameter("transactionAmount")))
      .setToken(request.getParameter("token"))
      .setDescription(request.getParameter("description"))
      .setInstallments(Integer.valueOf(request.getParameter("installments")))
      .setPaymentMethodId(request.getParameter("paymentMethodId"))
      .setNotificationUrl("http://requestbin.fullcontact.com/1ogudgk1");


Identification identification = new Identification();
identification.setType(request.getParameter("docType"))
             .setNumber(request.getParameter("docNumber")); 


Payer payer = new Payer();
payer.setEmail(request.getParameter("email"))
    .setIdentification(identification);
   
payment.setPayer(payer);


payment.save();


System.out.println(payment.getStatus());
```

```
require 'mercadopago'
sdk = Mercadopago::SDK.new('YOUR_ACCESS_TOKEN')


payment_data = {
 transaction_amount: params[:transactionAmount].to_f,
 token: params[:token],
 description: params[:description],
 installments: params[:installments].to_i,
 payment_method_id: params[:paymentMethodId],
 notification_url: "http://requestbin.fullcontact.com/1ogudgk1",
 payer: {
   email: params[:email],
   identification: {
     type: params[:docType],
     number: params[:docNumber]
   }
 }
}


payment_response = sdk.payment.create(payment_data)
payment = payment_response[:response]


puts payment
```

```
using System;
using MercadoPago.Client.Common;
using MercadoPago.Client.Payment;
using MercadoPago.Config;
using MercadoPago.Resource.Payment;


MercadoPagoConfig.AccessToken = "YOUR_ACCESS_TOKEN";


var paymentRequest = new PaymentCreateRequest
{
   TransactionAmount = decimal.Parse(Request["transactionAmount"]),
   Token = Request["token"],
   Description = Request["description"],
   Installments = int.Parse(Request["installments"]),
   PaymentMethodId = Request["paymentMethodId"],
   NotificationUrl = "http://requestbin.fullcontact.com/1ogudgk1",


   Payer = new PaymentPayerRequest
   {
       Email = Request["email"],
       Identification = new IdentificationRequest
       {
           Type = Request["docType"],
           Number = Request["docNumber"],
       },
   },
};


var client = new PaymentClient();
Payment payment = await client.CreateAsync(paymentRequest);


Console.WriteLine(payment.Status);
```

```
import mercadopago
sdk = mercadopago.SDK("ACCESS_TOKEN")


payment_data = {
   "transaction_amount": float(request.POST.get("transaction_amount")),
   "token": request.POST.get("token"),
   "description": request.POST.get("description"),
   "installments": int(request.POST.get("installments")),
   "payment_method_id": request.POST.get("payment_method_id"),
   "notification_url" =  "http://requestbin.fullcontact.com/1ogudgk1",
   "payer": {
       "email": request.POST.get("email"),
       "identification": {
           "type": request.POST.get("type"), 
           "number": request.POST.get("number")
       }
   }
}


payment_response = sdk.payment().create(payment_data)
payment = payment_response["response"]


print(payment)
```

```
accessToken := "{{ACCESS_TOKEN}}"


cfg, err := config.New(accessToken)
if err != nil {
   fmt.Println(err)
   return
}


client := payment.NewClient(cfg)


request := payment.Request{
   TransactionAmount: <transactionAmount>,
   Token: <token>,
   Description: <description>,
   Installments: <installments>,
   PaymentMethodID:   <paymentMethodId>,
   NotificationURL: "https:/mysite.com/notifications/new",
   Payer: &payment.PayerRequest{
      Email: <email>,
      Identification: &payment.IdentificationRequest{
         Type: <type>,
         Number: <number>,
      },
   },
}


resource, err := client.Create(context.Background(), request)
if err != nil {
fmt.Println(err)
}


fmt.Println(resource)
```

```
curl -X POST \
   -H 'accept: application/json' \
   -H 'content-type: application/json' \
   -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
   'https://api.mercadopago.com/v1/payments' \
   -d '{
         "transaction_amount": 100,
         "token": "ff8080814c11e237014c1ff593b57b4d",
         "description": "Blue shirt",
         "installments": 1,
         "payment_method_id": "visa",
         "issuer_id": 310,
         "notification_url": "http://requestbin.fullcontact.com/1ogudgk1",
         "payer": {
           "email": "test_payer@example.com"


         }
   }'
```

2\. Implement the notification receiver using the following code as an example: \`\`\`php <?php MercadoPago\\SDK::setAccessToken("ENV\_ACCESS\_TOKEN"); switch($\_POST\["type"\]) { case "payment": $payment = MercadoPago\\Payment::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "plan": $plan = MercadoPago\\Plan::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "subscription": $plan = MercadoPago\\Subscription::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "invoice": $plan = MercadoPago\\Invoice::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "point\_integration\_wh": // $\_POST contiene la informaciòn relacionada a la notificaciòn. break; } ?> \`\`\` After making the necessary configurations, the Webhooks notification will be delivered in \`JSON\` format. See the example of a notification for the \`payments\` topic and the descriptions of the information sent in the table below. > WARNING > > Important > > Test payments, created with test credentials, will not send notifications. The only way to test notification reception is through the \[Configuration through Your integrations\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks#bookmark\_configuration\_through\_your\_integrations). \`\`\`json { "id": 12345, "live\_mode": true, "type": "payment", "date\_created": "2015-03-25T10:04:58.396-04:00", "user\_id": 44444, "api\_version": "v1", "action": "payment.created", "data": { "id": "999999999" } } \`\`\` | Attribute | Description | Example in JSON | | --- | --- | --- | | \*\*id\*\* | Notification ID | \`12345\` | | \*\*live\_mode\*\* | Indicates if the URL provided is valid | \`true\` | | \*\*type\*\* | Type of notification received according to the previously selected topic (payments, mp-connect, subscription, claim, automatic-payments, etc.) | \`payment\` | | \*\*date\_created\*\* | Date the notified resource was created | \`2015-03-25T10:04:58.396-04:00\` | | \*\*user\_id\*\*| Seller identifier | \`44444\` | | \*\*api\_version\*\* | Value indicating the API version sending the notification | \`v1\` | | \*\*action\*\* | Notified event, indicating if it's a resource update or a new creation | \`payment.created\` | | \*\*data.id\*\* | ID of the payment, \`merchant\_order\`, or claim | \`999999999\` | > WARNING > > Important > > To obtain the notification format for topics other than \`payment\`, such as \`topic\_claims\_integration\_wh\` and \`topic\_card\_id\_wh\`, consult \[Additional information about notifications\](https://www.mercadopago.com.uy/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/additional-info). ::: :::: ## Necessary actions after receiving a notification When you receive a notification on your platform, Mercado Pago expects a response to validate that you received it correctly. To do this, you need to return an \`HTTP STATUS 200 (OK)\` or \`201 (CREATED)\` status. The \*\*waiting time\*\* for confirmation of receipt of notifications is \*\*22 seconds\*\*. If this confirmation is not sent, the system will understand that the notification was not received and will \*\*retry sending every 15 minutes\*\* until a response is received. After the third attempt, the interval will be extended, but the attempts will continue. After responding to the notification and confirming its receipt, you can obtain the complete information of the notified resource by making a request to the corresponding API endpoint. To identify which endpoint to use, check the table below: | Topic | URL | Documentation | | --- | --- | --- | | payment | \`https://api.mercadopago.com/v1/payments/\[ID\]\` | Get payment for \[Checkout API\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-api-payments/get-payment/get), \[Checkout Pro\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-payment/get) or \[Subscriptions\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/subscriptions/get-payment/get) | | order | \`https://api.mercadopago.com/v1/orders/{order\_id}\` | \[Get order by ID\](https://www.mercadopago.com.uy/developers/en/reference/in-person-payments/qr-code/orders/get-order/get) (for \[QR Code\](https://www.mercadopago.com.uy/developers/en/docs/qr-code/overview)) | | subscription\_preapproval | \`https://api.mercadopago.com/preapproval/search\` | \[Search subscriptions\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/subscriptions/search-preapproval/get) | | subscription\_preapproval\_plan | \`https://api.mercadopago.com/preapproval\_plan/search\` | \[Search subscription plans\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/subscriptions/search-preapproval-plan/get) | | subscription\_authorized\_payment | \`https://api.mercadopago.com/authorized\_payments/\[ID\]\` | \[Get invoice data\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/subscriptions/get-authorized-payment/get) | | topic\_claims\_integration\_wh | \`https://api.mercadopago.com/post-purchase/v1/claims/\[claim\_id\]\` | \[Get claim details\](https://www.mercadopago.com.uy/developers/en/reference/claims/get-claim-details/get) | | topic\_merchant\_order\_wh | \`https://api.mercadopago.com/merchant\_orders/\[ID\]\` | \[Get merchant order for Checkout Pro\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/merchant\_orders/get-merchant-order/get) or for \[QR Code (deprecated)\]()| | topic\_chargebacks\_wh | \`https://api.mercadopago.com/v1/chargebacks/\[ID\]\` | \[Get chargeback\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro/get-chargeback/get) | With this information, you will be able to make the necessary updates to your platform, such as updating an approved payment. ## Notifications dashboard The notification dashboard allows the user to view the events triggered on a specific integration, check the status, and obtain detailed information about these events. This dashboard will be displayed once you configure your Webhooks notifications, and you can access it anytime by clicking on \*\*Webhooks\*\* within the \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app). Among the available information, you will find the percentage of notifications delivered, as well as a quick view of which URLs and events are configured. Additionally, you will find a complete list of the latest notifications sent and their details, such as \*\*delivery status\*\* (success or failure), \*\*action\*\* (action associated with the triggered event), \*\*event\*\* (type of triggered event), and \*\*date and time\*\*. If desired, you can filter these displayed results by \*\*delivery status\*\* and by period (\*\*date and time\*\*). !\[notifications dashboard\](/images/dashboard/notification-dashboard-es-v1.png) ### Evet details When you click on one of the listed notifications, you can access the event details. This section provides additional information, allowing you to retrieve lost data in case of notification delivery failure, thereby keeping your system up to date. \* \*\*Status:\*\* Event status along with the corresponding success or error code. \* \*\*Event:\*\* Type of event triggered as selected in the notification configuration. \* \*\*Type:\*\* Topic to which the triggered event belongs as selected during configuration. \* \*\*Trigger date and time:\*\* Date and time when the event was triggered. \* \*\*Description:\*\* Detailed description of the event as documented. \* \*\*Trigger ID:\*\* Unique identifier of the sent notification. \* \*\*Request:\*\* JSON of the request corresponding to the triggered notification. !\[notifications details\](/images/dashboard/notification-details-dashboard-es-v1.png) In case of notification delivery failure, you can view the reasons and correct the necessary information to prevent future issues.