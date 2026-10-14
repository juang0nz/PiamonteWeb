# MD for: https://www.mercadopago.com.uy/developers/es/docs/checkout-pro-preferences/payment-notifications.md

\# Configure payment notifications \*\*Webhooks\*\*, also known as \*\*web callbacks\*\*, are an effective method that allows Mercado Pago servers to send \*\*real-time\*\* information when a specific event related to your integration occurs. Instead of your system constantly polling for updates, Webhooks allow for \*\*passive and automatic\*\* data transmission between Mercado Pago and your integration through an \*\*HTTP POST\*\* request, optimizing communication and reducing server load. Check the general flow of a notification in the diagram below. !\[Diagram\](/images/cow/notifications-diagrama-es-v1.jpg) Below, we present a step-by-step guide to configure payment creation and update notifications. Once configured, Webhook notifications will be sent every time a payment is created or its status is modified (Pending, Rejected, or Approved). > NOTE > > This documentation exclusively covers the configuration of payment notifications, including creations and updates, through the \*\*Payments\*\* event. To obtain information about other notification events available for configuration, please refer to the general \[Notifications documentation\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/additional-content/notifications). In the process of integrating with Mercado Pago, you can configure notifications in two ways: | Configuration Type | Description | Advantages | When to Use | |---|---|---|---| | Configuration through Your integrations | This method allows you to configure notifications directly in your Developer Panel. You can set up notifications for each of your applications, identify different accounts if necessary, and validate the origin of the notification using a secret signature. | - Simple identification of different accounts, ensuring proper management in diverse environments.   
 \- High security by validating the origin of notifications via a secret signature, which guarantees the integrity of the received information.   
 \- More versatile and effective for maintaining centralized control and efficiently managing communication with applications. | Recommended for most integrations. | | Configuration during the creation of preferences | Notifications are configured for each transaction individually during the preference creation process. | - Specific adjustments for each transaction.   
 \- Flexibility in cases where dynamic mandatory parameters are needed.   
 \- Ideal for integrations like payment platforms for multiple sellers. | Convenient in cases where it is necessary to send a dynamic query parameter mandatorily, and also suitable for integrations that function as a payment platform for multiple sellers. | > RED\_MESSAGE > > Important > > The URLs configured during the creation of a payment will take precedence over those configured through Your integrations. :::::AccordionComponent{title="Configuration through Your integrations"} ## Configuration through Your integrations You can configure notifications for each of your applications directly from \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app) efficiently and securely. In this section, we will explain how to: 1\. Indicate the notification URLs and configure events 2\. Validate the origin of a notification 3\. Simulate receiving a notification ### 1\. Indicate notification URLs and configure the event To configure Webhook notifications, it is necessary to indicate the URLs to which they will be sent. To do this, follow the step-by-step instructions below: 1\. Go to \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app) and select the application integrated with Checkout Pro for which you want to activate notifications. !\[Application\](/images/cow/not1-select-app-es-v1.png) 2\. In the left menu, select \*\*Webhooks > Configure Notifications\*\* and configure the URL that will be used to receive them. !\[Webhooks\](/images/cow/not2-webhooks-es-v1.png) 3\. Select the \*\*Production mode\*\* tab and provide an \`HTTPS URL\` to receive notifications with your production integration. !\[URL\](/images/cow/not3-url-es-v1.png) 4\. Select the \*\*Payments\*\* event to receive notifications, which will be sent in \`JSON\` format via an \`HTTPS POST\` to the URL specified earlier. !\[Payment\](/images/cow/not4-payment-es-v1.png) 5\. Finally, click on \*\*Save configuration\*\*. This will generate a \*\*secret key\*\* exclusive to the application, which will allow you to validate the authenticity of the received notifications, ensuring they were sent by Mercado Pago. Note that this generated key does not have an expiration date and its periodic renewal is not mandatory, although it is recommended. To do this, simply click the \*\*Reset\*\* button. ### 2\. Simulate notification reception To ensure that notifications are configured correctly, it is necessary to simulate their reception. Follow the steps below to perform the simulation: 1\. After configuring the URLs and Events, click \*\*Save configuration\*\*. 2\. Next, click \*\*Simulate\*\* to test whether the specified URL is receiving notifications correctly. 3\. On the simulation screen, select the URL to be tested, which can be \*\*either the test URL or the production URL\*\*. 4\. Then, choose the \*\*event type\*\* and enter the \*\*ID\*\* that will be sent in the notification body (\`Data ID\`). 5\. Finally, click \*\*Send test\*\* to verify the request, the response provided by the server, and the event description. You will receive a response similar to the example below, which represents the \`body\` of the notification received on your server. \`\`\`json { "action": "payment.updated", "api\_version": "v1", "data": { "id": "123456" }, "date\_created": "2021-11-01T02:02:02Z", "id": "123456", "live\_mode": false, "type": "payment", "user\_id": 724484980 } \`\`\` ### 3\. Validate the origin of a notification Validating the origin of a notification is fundamental to ensuring the security and authenticity of the received information. This process helps prevent fraud and guarantees that only legitimate notifications are processed. Mercado Pago will send a notification to your server similar to the example below for an alert with the topic \`payment\`. In this example, the complete notification is included, containing the \`query params\`, the \`body\`, and the \`header\` of the notification. - \*\*\_Query params\_\*\*: These are query parameters that accompany the URL. In the example, we have \`data.id=123456\` and \`type=payment\`. - \*\*\_Body\_\*\*: The body of the notification contains detailed information about the event, such as \`action\`, \`api\_version\`, \`data\`, \`date\_created\`, \`id\`, \`live\_mode\`, \`type\`, and \`user\_id\`. - \*\*\_Header\_\*\*: The header contains important metadata, including the secret signature of the notification \`x-signature\`. \`\`\` POST /test?data.id=123456&type=payment HTTP/1.1 Host: prueba.requestcatcher.com Accept: \*/\* Accept-Encoding: \* Connection: keep-alive Content-Length: 177 Content-Type: application/json Newrelic: eyJ2IjpbMCwxXSwiZCI6eyJ0eSI6IkFwcCIsImFjIjoiOTg5NTg2IiwiYXAiOiI5NjA2MzYwOTQiLCJ0eCI6IjU3ZjI4YzNjOWE2ODNlZDYiLCJ0ciI6IjY0NjA0OTM3OWI1ZjA3MzMyZDdhZmQxMjEyM2I5YWE4IiwicHIiOjAuNzk3ODc0LCJzYSI6ZmFsc2UsInRpIjoxNzQyNTA1NjM4Njg0LCJ0ayI6IjE3MDk3MDcifX0= Traceparent: 00-646049379b5f07332d7afd12123b9aa8-e7f77a41f687aecd-00 Tracestate: 1709707@nr=0-0-989586-960636094-e7f77a41f687aecd-57f28c3c9a683ed6-0-0.797874-1742505638684 User-Agent: restclient-node/4.15.3 X-Request-Id: bb56a2f1-6aae-46ac-982e-9dcd3581d08e X-Rest-Pool-Name: /services/webhooks.js X-Retry: 0 X-Signature: ts=1742505638683,v1=ced36ab6d33566bb1e16c125819b8d840d6b8ef136b0b9127c76064466f5229b X-Socket-Timeout: 22000 {"action":"payment.updated","api\_version":"v1","data":{"id":"123456"},"date\_created":"2021-11-01T02:02:02Z","id":"123456","live\_mode":false,"type":"payment","user\_id":724484980} \`\`\` From the received Webhook notification, you will be able to validate the authenticity of its origin. Mercado Pago will always include the secret key in the Webhook notifications that will be received, allowing you to validate their authenticity. This key will be sent in the \`x-signature\` header, which will be similar to the example below. \`\`\` \`ts=1742505638683,v1=ced36ab6d33566bb1e16c125819b8d840d6b8ef136b0b9127c76064466f5229b\` \`\`\` To confirm the validation, it is necessary to extract the key from the \_header\_ and compare it with the key provided for your application in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app). Follow one of the approaches below to validate the authenticity of the notification. ::::TabsComponent :::TabComponent{title="With SDK"} The official SDK implements HMAC-based Webhook Signature Verification to authenticate the origin of each received notification. To get your secret key (\`secret\`), select the application in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app), click \*\*Webhooks > Configure notification\*\*, and reveal the generated key. 

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
        request.headers.get(“x-signature”),
        request.headers.get(“x-request-id”),
        request.args.get(“data.id”),
        secret,
    )
    return “”, 200
except InvalidWebhookSignatureError:
    return “”, 401
```

```
import “github.com/mercadopago/sdk-go/pkg/webhook”

err := webhook.ValidateSignature(
    r.Header.Get(“x-signature”),
    r.Header.Get(“x-request-id”),
    r.URL.Query().Get(“data.id”),
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
        xSignature: Request.Headers[“x-signature”],
        xRequestId: Request.Headers[“x-request-id”],
        dataId:     Request.Query[“data.id”],
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
        request.getHeader(“x-signature”),
        request.getHeader(“x-request-id”),
        request.getParameter(“data.id”),
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

::: :::TabComponent{title="Without SDK"} > NOTE > > If any of the values (\`data.id\`, \`x-request-id\`) are not present in the received notification, you must remove them from the manifest before computing the \`HMAC\`. To validate the signature manually, follow these steps: 1\. Extract \`ts\` and \`v1\` from the \`x-signature\` \_header\_ by splitting on \`,\` 2\. Build the \_manifest\_: \`id:{data.id};request-id:{x-request-id};ts:{ts};\`, omitting pairs whose values are not present in the request 3\. Compute \`HMAC-SHA256(secret key, manifest)\` in hexadecimal 4\. Compare the result with \`v1\` in constant time 5\. If they match: respond with HTTP 200\. If not: respond with HTTP 401\. To get your secret key (\`secret\`), select the application in \[Your integrations\](https://www.mercadopago.com.uy/developers/panel/app), click \*\*Webhooks > Configure notification\*\*, and reveal the generated key. !\[cofigure notifications\](/images/cow/not6-signature-es-v1.png) 

php 

phpjavascriptpythongocsharpjavaruby

```
<?php
$xSignature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$xRequestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? '';
$dataID     = strtolower($_GET['data_id'] ?? ''); // PHP converts dots in query param names to underscores

$ts = null;
$hash = null;
foreach (explode(',', $xSignature) as $part) {
    $kv = explode('=', $part, 2);
    if (count($kv) !== 2) continue;
    $key   = trim($kv[0]);
    $value = trim($kv[1]);
    if ($key === 'ts') $ts   = $value;
    if ($key === 'v1') $hash = $value;
}

$parts = [];
if ($dataID     !== '') $parts[] = “id:{$dataID}”;
if ($xRequestId !== '') $parts[] = “request-id:{$xRequestId}”;
$parts[] = “ts:{$ts}”;
$manifest = implode(';', $parts) . ';';

$computed = hash_hmac('sha256', $manifest, $secret);
if (!hash_equals($computed, $hash)) {
    http_response_code(401);
    exit;
}
http_response_code(200);
```

```
const xSignature = req.headers['x-signature'] ?? '';
const xRequestId = req.headers['x-request-id'] ?? '';
const dataId     = (req.query['data.id'] ?? '').toLowerCase();

let ts, hash;
for (const part of xSignature.split(',')) {
    const eq  = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === 'ts') ts   = val;
    if (key === 'v1') hash = val;
}

const parts = [];
if (dataId)     parts.push(`id:${dataId}`);
if (xRequestId) parts.push(`request-id:${xRequestId}`);
parts.push(`ts:${ts}`);
const manifest = parts.join(';') + ';';

const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))) {
    res.status(401).end();
    return;
}
res.sendStatus(200);
```

```
import hashlib
import hmac

x_signature  = request.headers.get(“x-signature”, “”)
x_request_id = request.headers.get(“x-request-id”, “”)
data_id      = (request.args.get(“data.id”, “”) or “”).lower()

ts = hash_value = None
for part in x_signature.split(“,”):
    if “=” not in part:
        continue
    key, _, value = part.partition(“=”)
    key   = key.strip()
    value = value.strip()
    if key == “ts”: ts         = value
    if key == “v1”: hash_value = value

parts = []
if data_id:      parts.append(f”id:{data_id}”)
if x_request_id: parts.append(f”request-id:{x_request_id}”)
parts.append(f”ts:{ts}”)
manifest = “;”.join(parts) + “;”

computed = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
if not hmac.compare_digest(computed, hash_value):
    return “”, 401
return “”, 200
```

```
import (
    “crypto/hmac”
    “crypto/sha256”
    “encoding/hex”
    “net/http”
    “strings”
)

xSignature := r.Header.Get(“x-signature”)
xRequestID := r.Header.Get(“x-request-id”)
dataID     := strings.ToLower(r.URL.Query().Get(“data.id”))

var ts, hash string
for _, part := range strings.Split(xSignature, “,”) {
    kv := strings.SplitN(part, “=”, 2)
    if len(kv) != 2 { continue }
    key := strings.TrimSpace(kv[0])
    val := strings.TrimSpace(kv[1])
    if key == “ts” { ts   = val }
    if key == “v1” { hash = val }
}

var parts []string
if dataID     != “” { parts = append(parts, “id:”+dataID) }
if xRequestID != “” { parts = append(parts, “request-id:”+xRequestID) }
parts = append(parts, “ts:”+ts)
manifest := strings.Join(parts, “;”) + “;”

mac := hmac.New(sha256.New, []byte(secret))
mac.Write([]byte(manifest))
computed := hex.EncodeToString(mac.Sum(nil))

if !hmac.Equal([]byte(computed), []byte(hash)) {
    w.WriteHeader(http.StatusUnauthorized)
    return
}
w.WriteHeader(http.StatusOK)
```

```
using System.Security.Cryptography;
using System.Text;

var xSignature = Request.Headers[“x-signature”].ToString();
var xRequestId = Request.Headers[“x-request-id”].ToString();
var dataId     = (Request.Query[“data.id”].ToString() ?? “”).ToLowerInvariant();

string ts = null, hash = null;
foreach (var part in xSignature.Split(','))
{
    var eq = part.IndexOf('=');
    if (eq < 0) continue;
    var key = part[..eq].Trim();
    var val = part[(eq + 1)..].Trim();
    if (key == “ts”) ts   = val;
    if (key == “v1”) hash = val;
}

var parts = new List<string>();
if (!string.IsNullOrEmpty(dataId))     parts.Add($”id:{dataId}”);
if (!string.IsNullOrEmpty(xRequestId)) parts.Add($”request-id:{xRequestId}”);
parts.Add($”ts:{ts}”);
var manifest = string.Join(“;”, parts) + “;”;

using var hmacSha = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
var computed = BitConverter
    .ToString(hmacSha.ComputeHash(Encoding.UTF8.GetBytes(manifest)))
    .Replace(“-”, “”).ToLowerInvariant();

if (!CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(computed), Encoding.UTF8.GetBytes(hash)))
{
    return Unauthorized();
}
return Ok();
```

```
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

String xSignature = request.getHeader(“x-signature”) != null ? request.getHeader(“x-signature”) : “”;
String xRequestId = request.getHeader(“x-request-id”) != null ? request.getHeader(“x-request-id”) : “”;
String dataId     = request.getParameter(“data.id”) != null
    ? request.getParameter(“data.id”).toLowerCase() : “”;

String ts = null, hash = null;
for (String part : xSignature.split(“,”)) {
    String[] kv = part.split(“=”, 2);
    if (kv.length != 2) continue;
    String key = kv[0].trim();
    String val = kv[1].trim();
    if (“ts”.equals(key)) ts   = val;
    if (“v1”.equals(key)) hash = val;
}

List<String> parts = new ArrayList<>();
if (!dataId.isEmpty())     parts.add(“id:” + dataId);
if (!xRequestId.isEmpty()) parts.add(“request-id:” + xRequestId);
parts.add(“ts:” + ts);
String manifest = String.join(“;”, parts) + “;”;

Mac mac = Mac.getInstance(“HmacSHA256”);
mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), “HmacSHA256”));
byte[] bytes = mac.doFinal(manifest.getBytes(StandardCharsets.UTF_8));
StringBuilder sb = new StringBuilder();
for (byte b : bytes) sb.append(String.format(“%02x”, b & 0xff));
String computed = sb.toString();

if (!MessageDigest.isEqual(
    computed.getBytes(StandardCharsets.UTF_8),
    hash.getBytes(StandardCharsets.UTF_8)))
{
    response.setStatus(401);
    return;
}
response.setStatus(200);
```

```
require 'openssl'

x_signature  = request.headers['x-signature'] || ''
x_request_id = request.headers['x-request-id'] || ''
data_id      = (params['data.id'] || '').downcase

ts = hash_value = nil
x_signature.split(',').each do |part|
    key, value = part.split('=', 2)
    next unless key && value
    ts         = value.strip if key.strip == 'ts'
    hash_value = value.strip if key.strip == 'v1'
end

parts = []
parts << “id:#{data_id}”               unless data_id.empty?
parts << “request-id:#{x_request_id}” unless x_request_id.empty?
parts << “ts:#{ts}”
manifest = “#{parts.join(';')};”

computed = OpenSSL::HMAC.hexdigest('SHA256', secret, manifest)
unless OpenSSL.fixed_length_secure_compare(computed, hash_value)
    head :unauthorized
    return
end
head :ok
```

::: :::: ::::: :::::AccordionComponent{title="Configuration when creating preferences"} ## Configuration when creating preferences During the process of creating \[preferences\](https://www.mercadopago.com.uy/developers/en/reference/online-payments/checkout-pro-preferences/preferences/create-preference/post), it is possible to configure the notification URL more specifically for each payment using the \`notification\_url\` field. > RED\_MESSAGE > > Important > > The \`notification\_url\` must be an HTTPS URL. This ensures that notifications are transmitted securely and that exchanged data is encrypted, protecting the integrity and confidentiality of the information. Additionally, HTTPS authenticates that the communication is being made with the legitimate server, avoiding possible malicious interceptions. Below, we explain how to configure notifications when creating a payment using our SDKs. 1\. In the \`notification\_url\` field, specify the URL from which notifications will be received, as shown below. 

php 

phpnodejavarubycsharppythongo

```
<?php
$client = new PreferenceClient();
$preference = $client->create([
  "notification_url" => "https://www.your_url_to_notification.com/",
  "items"=> array(
    array(
      "title" => "Mi producto",
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
    notification_url: 'https://www.your_url_to_notification.com/',
    items: [
      {
        title: 'Mi producto',
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
Preference preference = client.create(request);
```

```
# Crea un objeto de preferencia
preference_data = {
  notification_url: 'https://www.your_url_to_notification.com/',
  items: [
    {
      title: 'Mi producto',
      unit_price: 75.56,
      quantity: 1
    }
  ]
}
preference_response = sdk.preference.create(preference_data)
preference = preference_response[:response]

# Este valor reemplazará el string "<%= @preference_id %>" en tu HTML
@preference_id = preference['id']
```

```
// Crea el objeto de request de la preference
var request = new PreferenceRequest
{
    Items = new List<PreferenceItemRequest>
    {
        new PreferenceItemRequest
        {
            Title = "Mi producto",
            Quantity = 1,
            CurrencyId = "ARS",
            UnitPrice = 75.56m,
        },
    },
};

// Crea la preferencia usando el client
var client = new PreferenceClient();
Preference preference = await client.CreateAsync(request);
```

```
# Crea un ítem en la preferencia
preference_data = {
    "notification_url" : "https://www.your_url_to_notification.com/",
    "items": [
        {
            "title": "Mi producto",
            "quantity": 1,
            "unit_price": 75.76,
        }
    ]
}

preference_response = sdk.preference().create(preference_data)
preference = preference_response["response"]
```

```
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

\> WARNING > > Do not use local domains in the \`notification\_url\` value, such as 'localhost/' or '127.0.0.1' with or without a specified port. We recommend using a server with a named domain (DNS) or an externally accessible development IP so that Mercado Pago can send notifications correctly. 2\. Implement the notification receiver using the following code as an example: \`\`\`php <?php MercadoPago\\SDK::setAccessToken("ENV\_ACCESS\_TOKEN"); switch($\_POST\["type"\]) { case "payment": $payment = MercadoPago\\Payment::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "plan": $plan = MercadoPago\\Plan::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "subscription": $plan = MercadoPago\\Subscription::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "invoice": $plan = MercadoPago\\Invoice::find\_by\_id($\_POST\["data"\]\["id"\]); break; case "point\_integration\_wh": // $\_POST contiene la informaciòn relacionada a la notificaciòn. break; } ?> \`\`\` After performing the necessary configuration, the Webhook notification will be sent in \`JSON\` format. Below you can see an example of a notification for the \`payment\` topic, and the descriptions of the information sent in the table below. > RED\_MESSAGE > > Important > > Test payments, created with test credentials, will not send notifications. The only way to test notification reception is through \[Configuration via Your integrations\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/payment-notifications#bookmark\_configuration\_through\_your\_integrations). \`\`\`json { "id": 12345, "live\_mode": true, "type": "payment", "date\_created": "2015-03-25T10:04:58.396-04:00", "user\_id": 44444, "api\_version": "v1", "action": "payment.created", "data": { "id": "999999999" } } \`\`\` | Attribute | Description | Example in JSON | | --- | --- | --- | | \*\*id\*\* | Notification ID | \`12345\` | | \*\*live\_mode\*\* | Indicates if the entered URL is valid. | \`true\` | | \*\*type\*\* | Type of notification received according to the previously selected topic (payments, mp-connect, subscription, claim, automatic-payments, etc) | \`payment\` | | \*\*date\_created\*\* | Creation date of the notified resource | \`2015-03-25T10:04:58.396-04:00\` | | \*\*user\_id\*\* | Seller identifier | \`44444\` | | \*\*api\_version\*\* | Value indicating the API version that sends the notification | \`v1\` | | \*\*action\*\* | Notified event, indicating whether it is an update of a resource or the creation of a new one | \`payment.created\` | | \*\*data.id\*\* | ID of the payment, commercial order, or claim. | \`999999999\` | ::::: Once notifications are configured, check the Necessary actions after receiving a notification to inform that they were properly received. ## Necessary actions after receiving the notification When you receive a notification on your platform, Mercado Pago expects a response to validate that the reception was correct. For this, you must return an \`HTTP STATUS 200 (OK)\` or \`201 (CREATED)\`. The timeout for this confirmation will be 22 seconds. If this response is not sent, the system will understand that the notification was not received and will make a new attempt to send it every 15 minutes until it receives the response. After the third attempt, the interval will be extended, but the sending will continue. 


sequenceDiagram
    participant MercadoPago as Mercado Pago
    participant Integrator as Integrator

    MercadoPago->>Integrator: retry: 1. Delay: 0 minutes
    MercadoPago->>Integrator: retry: 2. Delay: 15 minutes
    MercadoPago->>Integrator: retry: 3. Delay: 30 minutes
    MercadoPago->>Integrator: retry: 4. Delay: 6 hours
    MercadoPago->>Integrator: retry: 5. Delay: 48 hours
    MercadoPago->>Integrator: retry: 6. Delay: 96 hours
    MercadoPago->>Integrator: retry: 7. Delay: 96 hours
    MercadoPago->>Integrator: retry: 8. Delay: 96 hours

After responding to the notification, confirming its receipt, you can obtain all information about the notified \`payments\` topic event by making a GET request to the endpoint :TagComponent{tag="GET" text="/v1/payments/{id}" href="/developers/en/reference/online-payments/checkout-pro-preferences/get-payment/get" color="accent"}. With this information, you will be able to make the necessary updates to your platform, such as updating an approved payment. > NOTE > > If payments with two payment methods are enabled, activate and process notifications for the \*\*Payments\*\* (\`payment\`) and \*\*Merchant orders\*\* (\`merchant\_order\` or \`topic\_merchant\_order\_wh\`, depending on the notification type) events. A single purchase may generate more than one \`payment\_id\` and therefore more than one payment notification. Use the merchant order notification to reconcile the payments associated with the \`merchant\_order\` before delivering the product or service. For more information, see \[How to accept payments with two payment methods\](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/additional-settings/pay-with-two-methods). Process every notification associated with the purchase, even if one of the transactions has already been approved. Additionally, to check the status of the event after the notification, you can use the various methods of our SDKs to perform the query with the ID that was sent in the notification. 

java 

javanoderubycsharppythongolang

```
MercadoPago.SDK.setAccessToken("ENV_ACCESS_TOKEN");
switch (type) {
    case "payment":
        Payment payment = Payment.findById(data.id);
        break;
    case "plan":
        Plan plan = Plan.findById(data.id);
        break;
    case "subscription":
        Subscription subscription = Subscription.findById(data.id);
        break;
    case "invoice":
        Invoice invoice = Invoice.findById(data.id);
        break;
    case "point_integration_wh":
        // POST contiene la informaciòn relacionada a la notificaciòn.
        break;
}
```

```
mercadopago.configurations.setAccessToken('ENV_ACCESS_TOKEN');
switch (type) {
  case 'payment':
    const payment = await mercadopago.payment.findById(data.id);
    break;
  case 'plan':
    const plan = await mercadopago.plans.get(data.id);
    break;
  case 'subscription':
    const subscription = await mercadopago.subscriptions.get(data.id);
    break;
  case 'invoice':
    const invoice = await mercadopago.invoices.get(data.id);
    break;
  case 'point_integration_wh':
    // Contiene la informaciòn relacionada a la notificaciòn.
    break;
}
```

```
sdk = Mercadopago::SDK.new('PROD_ACCESS_TOKEN')

case payload['type']
when 'payment'
    payment = sdk.payment.search(filters: { id: payload['data']['id'] })
when 'plan'
    plan = sdk.preapproval_plan.search(filters: { id: data['data']['id'] })
end
```

```
MercadoPagoConfig.AccessToken = "ENV_ACCESS_TOKEN";
switch (type)
{
    case "payment":
        Payment payment = await Payment.FindByIdAsync(payload["data"]["id"].ToString());
        break;
    case "plan":
        Plan plan = await Plan.FindByIdAsync(payload["data"]["id"].ToString());
        break;
    case "subscription":
        Subscription subscription = await Subscription.FindByIdAsync(payload["data"]["id"].ToString());
        break;
    case "invoice":
        Invoice invoice = await Invoice.FindByIdAsync(payload["data"]["id"].ToString());
        break;
    case "point_integration_wh":
        // Contiene la informaciòn relacionada a la notificaciòn.
        break;
}
```

```
sdk = mercadopago.SDK("ENV_ACCESS_TOKEN")
notification_type = data["type"]
if notification_type == "payment":
    payment = sdk.payment().get(payload["data"]["id"])
elif notification_type == "plan":
    plan = sdk.preapproval().get(payload["data"]["id"]) 
elif notification_type == "subscription":
    subscription = sdk.preapproval().get(payload["data"]["id"])
elif notification_type == "invoice":
    invoice = sdk.invoice().get(payload["data"]["id"])
elif notification_type == "point_integration_wh":
    # Contiene la informaciòn relacionada a la notificaciòn.
else:
    return
```

```
cfg, err := config.New("ENV_ACCESS_TOKEN")
if err != nil {
    fmt.Println(err)
}

switch req.Body.Type {
case "payment":
    client := payment.NewClient(cfg)
    resource, err = client.Get(context.Background(), req.Body.data.id)
    if err != nil {
        fmt.Println(err)
        return
    }
case "plan":
    client := preapprovalplan.NewClient(cfg)
    resource, err := client.Get(context.Background(), req.Body.data.id)
    if err != nil {
        fmt.Println(err)
        return
    }
}
```