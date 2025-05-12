import { FastMCP } from "fastmcp";
import { z } from "zod";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { config } from "dotenv";
import type { 
  CreateComaxPaymentLinkParams,
  CreateComaxPaymentLinkResult,
  UpdateComaxOrderPaymentParams,
  UpdateComaxOrderPaymentResult,
  ComaxOrderItem,
  GetComaxCustomerDetailsParams,
  GetComaxCustomerDetailsResult,
  ComaxCustomerDetails,
  GetComaxOrderStatusParams,
  ComaxOrderStatusResult,
  GetComaxOrderDetailsParams,
  ComaxOrderDetailsResult,
  GetComaxOrderPDFLinkParams,
  SetComaxOrderStatusParams,
  GetComaxOrdersByCreditCardParams,
  ComaxOrderByCreditCard,
  GetComaxOrdersSimpleParams,
  ChkItemExistsInOrdersParams,
  SetComaxOrderSelfPickupParams,
} from "./types/api.js";

// Load environment variables
config();

const COMAX_ORDER_ENDPOINT = "http://ws.comax.co.il/Comax_WebServices/CustomersOrders_Service.asmx";
const COMAX_TOKEN_ENDPOINT = "http://ws.comax.co.il/WS_WRK/Work_Comax_WS/Credit_GetTokenLogin.asmx";
const COMAX_PAYMENT_PAGE = "http://ws.comax.co.il/Comax_WebServices/Credit/ShortCreditInput_V.aspx";
const COMAX_CUSTOMER_ENDPOINT = "http://ws.comax.co.il/Comax_WebServices/Customers_Service.asmx";

// Get credentials from environment variables
const ORDER_LOGIN_ID = process.env.ORDER_LOGIN_ID;
const ORDER_LOGIN_PASSWORD = process.env.ORDER_LOGIN_PASSWORD;
const TOKEN_LOGIN_NAME = process.env.TOKEN_LOGIN_NAME;
const TOKEN_LOGIN_PASSWORD = process.env.TOKEN_LOGIN_PASSWORD;
const PAYMENT_LOGIN_ID = process.env.PAYMENT_LOGIN_ID;
const PAYMENT_LOGIN_PASSWORD = process.env.PAYMENT_LOGIN_PASSWORD;
const BRANCH_ID = Number(process.env.BRANCH_ID) || 6;
const STORE_ID = Number(process.env.STORE_ID) || 6;
const PRICE_LIST_ID = Number(process.env.PRICE_LIST_ID) || 1;
const RETURN_PAGE = process.env.RETURN_PAGE || "https://www.gimo.co.il/";

// Validate required environment variables
if (!ORDER_LOGIN_ID || !ORDER_LOGIN_PASSWORD || !TOKEN_LOGIN_NAME || !TOKEN_LOGIN_PASSWORD || !PAYMENT_LOGIN_ID || !PAYMENT_LOGIN_PASSWORD) {
  throw new Error("Missing required environment variables. Please check your .env file.");
}

const server = new FastMCP({
  name: "Comax Payment Link MCP",
  version: "1.0.0",
});

const comaxOrderItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  totalSum: z.number().positive(),
  remarks: z.string().optional(),
});

server.addTool({
  name: "create_comax_payment_link",
  description: "Creates a Comax order and returns a payment link for the user to complete payment. Supports multiple items, business customers, and more.",
  parameters: z.object({
    customerId: z.string().default("22222"),
    customerName: z.string(),
    customerPhone: z.string(),
    customerCity: z.string(),
    customerAddress: z.string().optional(),
    customerZip: z.string().optional(),
    priceListId: z.number().int().optional(),
    items: z.array(comaxOrderItemSchema).min(1),
    reference: z.string().optional(),
    remarks: z.string().optional(),
  }) as z.ZodType<CreateComaxPaymentLinkParams>,
  execute: async (args, { log }) => {
    const reference = args.reference || `GIMO_ORDER_${Date.now()}`;
    const priceListId = args.priceListId || PRICE_LIST_ID;
    const totalSum = args.items.reduce((sum, item) => sum + item.totalSum, 0);
    const itemsXml = args.items.map(item => `<string>${item.sku}</string>`).join("");
    const quantityXml = args.items.map(item => `<string>${item.quantity}</string>`).join("");
    const priceXml = args.items.map(item => `<string>${item.price}</string>`).join("");
    const totalSumXml = args.items.map(item => `<string>${item.totalSum}</string>`).join("");
    const remarksXml = args.items.map(item => `<string>${item.remarks || ""}</string>`).join("");
    const orderXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <WriteCustomersOrderByParamsExtendedPlusPrice xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <CustomerID>${args.customerId}</CustomerID>\n      <StoreID>${STORE_ID}</StoreID>\n      <BranchID>${BRANCH_ID}</BranchID>\n      <PriceListID>${priceListId}</PriceListID>\n      <DoJ5>true</DoJ5>\n      <Remarks>${args.remarks || "Order via API"}</Remarks>\n      <Details>Order for ${args.customerName}</Details>\n      <Reference>${reference}</Reference>\n      <Mode>Add</Mode>\n      <DocNumber></DocNumber>\n      <ManualDocNumber>false</ManualDocNumber>\n      <Items>${itemsXml}</Items>\n      <Quantity>${quantityXml}</Quantity>\n      <Price>${priceXml}</Price>\n      <DiscountPercent><string>0</string></DiscountPercent>\n      <TotalSum>${totalSumXml}</TotalSum>\n      <ItemRemarks>${remarksXml}</ItemRemarks>\n      <CustomerName>${args.customerName}</CustomerName>\n      <CustomerPhone>${args.customerPhone}</CustomerPhone>\n      <CustomerCity>${args.customerCity}</CustomerCity>\n      ${args.customerAddress ? `<CustomerAddress>${args.customerAddress}</CustomerAddress>` : ""}\n      ${args.customerZip ? `<CustomerZip>${args.customerZip}</CustomerZip>` : ""}\n      <Status>1</Status>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </WriteCustomersOrderByParamsExtendedPlusPrice>\n  </soap:Body>\n</soap:Envelope>`;

    const orderRes = await fetch(COMAX_ORDER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://ws.comax.co.il/Comax_WebServices/WriteCustomersOrderByParamsExtendedPlusPrice",
      },
      body: orderXml,
    });
    const orderText = await orderRes.text();
    const orderJson = await parseStringPromise(orderText);
    let docNumber = null;
    try {
      docNumber = orderJson["soap:Envelope"]["soap:Body"][0]["WriteCustomersOrderByParamsExtendedPlusPriceResponse"][0]["WriteCustomersOrderByParamsExtendedPlusPriceResult"][0]["DocNumber"][0];
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to parse DocNumber from Comax order response: ${orderText}`,
          },
        ],
      };
    }

    const tokenXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <getLoginDetailsParams xmlns=\"http://tempuri.org/\">\n      <TokenParams>\n        <Odbc></Odbc>\n        <Scm>${totalSum}</Scm>\n        <ProceedOnShvaErr></ProceedOnShvaErr>\n        <returnPage>${RETURN_PAGE}</returnPage>\n        <getErrMsg>1</getErrMsg>\n        <BranchID>${BRANCH_ID}</BranchID>\n        <Token></Token>\n        <currency>ILS</currency>\n        <UniqueID>${docNumber}</UniqueID>\n        <Ref>${reference}</Ref>\n        <MaxPaymentsNumber>12</MaxPaymentsNumber>\n        <AutoCreditCompany>1</AutoCreditCompany>\n        <ViewTotal>1</ViewTotal>\n      </TokenParams>\n      <LoginName>${TOKEN_LOGIN_NAME}</LoginName>\n      <Password>${TOKEN_LOGIN_PASSWORD}</Password>\n    </getLoginDetailsParams>\n  </soap:Body>\n</soap:Envelope>`;

    const tokenRes = await fetch(COMAX_TOKEN_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/getLoginDetailsParams",
      },
      body: tokenXml,
    });
    const tokenText = await tokenRes.text();
    const tokenJson = await parseStringPromise(tokenText);
    let tokenLogin = null;
    try {
      tokenLogin = tokenJson["soap:Envelope"]["soap:Body"][0]["getLoginDetailsParamsResponse"][0]["getLoginDetailsParamsResult"][0];
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to parse TokenLogin from Comax token response: ${tokenText}`,
          },
        ],
      };
    }

    const paymentUrl = `${COMAX_PAYMENT_PAGE}?LoginID=${PAYMENT_LOGIN_ID}&LoginPassword=${PAYMENT_LOGIN_PASSWORD}&TokenLogin=${encodeURIComponent(tokenLogin)}&MaxPaymentsNumber=12&GetErrMsg=1&AutoCreditCompany=1&ViewTotal=1&IsSecure190123`;

      return {
        content: [
          {
            type: "text",
          text: `Comax payment link created.\n\nOrder DocNumber: ${docNumber}\nPayment Link: ${paymentUrl}`,
        },
      ],
    };
  },
});

server.addTool({
  name: "update_comax_order_payment",
  description: "Updates a Comax order with payment confirmation after user completes payment. Use this after receiving payment result (logc) from returnPage.",
  parameters: z.object({
    docNumber: z.string(),
    customerId: z.string().default("22222"),
    storeId: z.number().int().default(STORE_ID),
    branchId: z.number().int().default(BRANCH_ID),
    priceListId: z.number().int().optional(),
    payType: z.string(),
    creditTokenNumber: z.string(),
    creditCompany: z.string(),
    creditCardNumber: z.string(),
    creditExpireDate: z.string(),
    creditTZ: z.string(),
    creditPaysNumber: z.string(),
    creditTransactionType: z.string(),
    items: z.array(comaxOrderItemSchema).min(1),
    remarks: z.string().optional(),
  }) as z.ZodType<UpdateComaxOrderPaymentParams>,
  execute: async (args, { log }) => {
    const priceListId = args.priceListId || PRICE_LIST_ID;
    const itemsXml = args.items.map(item => `<string>${item.sku}</string>`).join("");
    const quantityXml = args.items.map(item => `<string>${item.quantity}</string>`).join("");
    const priceXml = args.items.map(item => `<string>${item.price}</string>`).join("");
    const totalSumXml = args.items.map(item => `<string>${item.totalSum}</string>`).join("");
    const remarksXml = args.items.map(item => `<string>${item.remarks || ""}</string>`).join("");
    const updateXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <WriteCustomersOrderByParamsExtendedPlusPrice xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n      <DocNumber>${args.docNumber}</DocNumber>\n      <CustomerID>${args.customerId}</CustomerID>\n      <StoreID>${args.storeId}</StoreID>\n      <BranchID>${args.branchId}</BranchID>\n      <Mode>Update</Mode>\n      <PayType>${args.payType}</PayType>\n      <CreditTokenNumber>${args.creditTokenNumber}</CreditTokenNumber>\n      <CreditCompany>${args.creditCompany}</CreditCompany>\n      <CreditCardNumber>${args.creditCardNumber}</CreditCardNumber>\n      <CreditExpireDate>${args.creditExpireDate}</CreditExpireDate>\n      <CreditTZ>${args.creditTZ}</CreditTZ>\n      <CreditPaysNumber>${args.creditPaysNumber}</CreditPaysNumber>\n      <CreditTransactionType>${args.creditTransactionType}</CreditTransactionType>\n      <Items>${itemsXml}</Items>\n      <Quantity>${quantityXml}</Quantity>\n      <Price>${priceXml}</Price>\n      <TotalSum>${totalSumXml}</TotalSum>\n      <PriceListID>${priceListId}</PriceListID>\n      <DoJ5>true</DoJ5>\n      <Remarks>${args.remarks || "Order payment updated with LOGC."}</Remarks>\n    </WriteCustomersOrderByParamsExtendedPlusPrice>\n  </soap:Body>\n</soap:Envelope>`;

    const updateRes = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://ws.comax.co.il/Comax_WebServices/WriteCustomersOrderByParamsExtendedPlusPrice",
      },
      body: updateXml,
    });
    const updateText = await updateRes.text();
    if (!updateRes.ok) {
      return {
        content: [
          {
            type: "text",
            text: `Comax order update failed: ${updateText}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Order updated with payment confirmation.\n\nDocNumber: ${args.docNumber}`,
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_customer_details",
  description: "Fetches Comax business customer details by CustomerID. Returns all available fields, including price list, discount, and contact info.",
  parameters: z.object({
    customerId: z.string(),
  }) as z.ZodType<GetComaxCustomerDetailsParams>,
  execute: async (args, { log }) => {
    const customerXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <Get_CustomerDetails xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <CustomerID>${args.customerId}</CustomerID>\n      <CustomerDetails></CustomerDetails>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </Get_CustomerDetails>\n  </soap:Body>\n</soap:Envelope>`;

    const res = await fetch(`${COMAX_CUSTOMER_ENDPOINT}?op=Get_CustomerDetails`, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://ws.comax.co.il/Comax_WebServices/Get_CustomerDetails",
      },
      body: customerXml,
    });
    const xml = await res.text();
    let customer: ComaxCustomerDetails | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["Get_CustomerDetailsResponse"];
      const result = response["Get_CustomerDetailsResult"];
      success = result === "true";
      if (success) {
        const details = response["CustomerDetails"];
        customer = details as ComaxCustomerDetails;
      } else {
        error = "Comax returned false for Get_CustomerDetailsResult.";
      }
    } catch (e) {
      error = `Failed to parse Comax customer details XML: ${e}`;
    }
    if (!success || !customer) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch customer details.\n${error || "Unknown error."}`,
          },
        ],
      };
    }
    // Format a summary
    const summary = `Customer: ${customer.Name} (ID: ${customer.ID})\nCity: ${customer.City || "-"}\nPhone: ${customer.Phone || "-"}\nEmail: ${customer.Email || "-"}\nPriceListID: ${customer.PriceListID || "-"}\nDiscount: ${customer.DiscountPercent || "-"}\nBlocked: ${customer.IsBlocked ? "Yes" : "No"}`;
    return {
      content: [
        {
          type: "text",
          text: summary + "\n\nFull details as JSON:\n```json\n" + JSON.stringify(customer, null, 2) + "\n```",
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_order_status",
  description:
    "Get order status by DocNumber or Reference. Returns status code, name, tracking, and more.",
  parameters: z.object({
    docNumber: z.string().optional(),
    reference: z.string().optional(),
  }) as z.ZodType<GetComaxOrderStatusParams>,
  execute: async (args, { log }) => {
    if (!args.docNumber && !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either docNumber or reference.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <GetCustomerOrderStatus xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <DocNumber>${args.docNumber ? args.docNumber : 0}</DocNumber>\n      <Reference>${args.reference ? args.reference : 0}</Reference>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </GetCustomerOrderStatus>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/GetCustomerOrderStatus",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let status: ComaxOrderStatusResult | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    let rawXml: string | undefined = xml;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["GetCustomerOrderStatusResponse"];
      const result = response["GetCustomerOrderStatusResult"];
      if (result) {
        status = {
          StatusCode: parseInt(result.StatusCode),
          StatusName: result.StatusName,
          TrackingNumber: result.TrackingNumber,
          ErrorMessage: result.ErrorMessage,
          SelfSupply: result.SelfSupply === "true" || result.SelfSupply === true,
          CloseOrder: result.CloseOrder ? parseInt(result.CloseOrder) : undefined,
          SwClose: result.SwClose ? parseInt(result.SwClose) : undefined,
          DeliveryStore: result.DeliveryStore
            ? parseInt(result.DeliveryStore)
            : undefined,
          DocNumber: result.DocNumber?.toString(),
        };
        success = true;
      } else {
        error = "No GetCustomerOrderStatusResult in response.";
      }
    } catch (e) {
      error = `Failed to parse Comax order status XML: ${e}`;
    }
    if (!success || !status) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch order status.\n${error || "Unknown error."}\n\nRaw XML:\n${rawXml}`,
          },
        ],
      };
    }
    // Format a summary
    const summary = `Order Status: ${status.StatusName} (Code: ${status.StatusCode})\nTracking: ${status.TrackingNumber || "-"}\nClosed: ${status.CloseOrder ? "Yes" : "No"}\nError: ${status.ErrorMessage || "-"}`;
    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\nFull status as JSON:\n```json\n" +
            JSON.stringify(status, null, 2) +
            "\n```",
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_order_details",
  description:
    "Get order details by DocNumber, DocYear, and Reference. All are required. Returns all order fields, customer, errors, etc.",
  parameters: z.object({
    docNumber: z.string(),
    docYear: z.string(),
    reference: z.string(),
  }) as z.ZodType<GetComaxOrderDetailsParams>,
  execute: async (args, { log }) => {
    if (!args.docNumber || !args.docYear || !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide docNumber, docYear, and reference.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <Get_CustomerOrderDetails xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <DocNumber>${args.docNumber}</DocNumber>\n      <DocYear>${args.docYear}</DocYear>\n      <Reference>${args.reference}</Reference>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </Get_CustomerOrderDetails>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/Get_CustomerOrderDetails",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let details: ComaxOrderDetailsResult | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    let rawXml: string | undefined = xml;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["Get_CustomerOrderDetailsResponse"];
      const result = response["Get_CustomerOrderDetailsResult"];
      if (result) {
        details = result;
        success = true;
      } else {
        error = "No Get_CustomerOrderDetailsResult in response.";
      }
    } catch (e) {
      error = `Failed to parse Comax order details XML: ${e}`;
    }
    if (!success || !details) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch order details.\n${error || "Unknown error."}\n\nRaw XML:\n${rawXml}`,
          },
        ],
      };
    }
    // Format a summary
    const summary = `Order: ${details.DocNumber || "-"} | Customer: ${details.CustomerID || "-"} | Total: ${details.TotalSum || "-"} | Status: ${details.Status || "-"}`;
    return {
      content: [
        {
          type: "text",
          text:
            summary +
            "\n\nFull order details as JSON:\n```json\n" +
            JSON.stringify(details, null, 2) +
            "\n```",
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_order_pdf_link",
  description:
    "Get order PDF link by DocNumber, Reference, or DocYear. Returns a direct PDF URL if available.",
  parameters: z.object({
    docNumber: z.string().optional(),
    reference: z.string().optional(),
    docYear: z.string().optional(),
    swBySpool: z.boolean().optional(),
  }) as z.ZodType<GetComaxOrderPDFLinkParams>,
  execute: async (args, { log }) => {
    if (!args.docNumber && !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either docNumber or reference.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <Get_CustomerOrderPDF_Link xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <DocNumber>${args.docNumber ? args.docNumber : 0}</DocNumber>\n      <Reference>${args.reference ? args.reference : 0}</Reference>\n      <DocYear>${args.docYear ? args.docYear : 0}</DocYear>\n      <SwBySpool>${typeof args.swBySpool === "boolean" ? args.swBySpool : false}</SwBySpool>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </Get_CustomerOrderPDF_Link>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/Get_CustomerOrderPDF_Link",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let pdfUrl: string | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    let rawXml: string | undefined = xml;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["Get_CustomerOrderPDF_LinkResponse"];
      const result = response["Get_CustomerOrderPDF_LinkResult"];
      if (result && typeof result === "string" && result.startsWith("http")) {
        pdfUrl = result;
        success = true;
      } else {
        error = result || "No Get_CustomerOrderPDF_LinkResult in response.";
      }
    } catch (e) {
      error = `Failed to parse Comax order PDF link XML: ${e}`;
    }
    if (!success || !pdfUrl) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch order PDF link.\n${error || "Unknown error."}\n\nRaw XML:\n${rawXml}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Order PDF link: ${pdfUrl}`,
        },
      ],
    };
  },
});

server.addTool({
  name: "set_comax_order_status",
  description:
    "Set order status by DocNumber, DocYear, Reference, Status, and StatusCode. Returns true if successful.",
  parameters: z.object({
    docNumber: z.string().optional(),
    docYear: z.string().optional(),
    reference: z.string().optional(),
    status: z.string().optional(),
    statusCode: z.number().optional(),
  }) as z.ZodType<SetComaxOrderStatusParams>,
  execute: async (args, { log }) => {
    if (!args.docNumber && !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either docNumber or reference.",
          },
        ],
      };
    }
    if (!args.status && !args.statusCode) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide at least one of status or statusCode.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <SetCustomerOrderStatusByParams xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <DocNumber>${args.docNumber ? args.docNumber : 0}</DocNumber>\n      <DocYear>${args.docYear ? args.docYear : 0}</DocYear>\n      <Reference>${args.reference ? args.reference : 0}</Reference>\n      <Status>${args.status || ""}</Status>\n      <StatusCode>${typeof args.statusCode === "number" ? args.statusCode : 0}</StatusCode>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </SetCustomerOrderStatusByParams>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
      method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/SetCustomerOrderStatusByParams",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let success = false;
    let error: string | undefined = undefined;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["SetCustomerOrderStatusByParamsResponse"];
      const result = response["SetCustomerOrderStatusByParamsResult"];
      if (result === "true" || result === true) {
        success = true;
      } else {
        error = result || "Comax returned false for SetCustomerOrderStatusByParamsResult.";
      }
    } catch (e) {
      error = `Failed to parse Comax set order status XML: ${e}`;
    }
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to set order status.\n${error || "Unknown error."}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Order status updated successfully.`,
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_orders_by_credit_card",
  description:
    "Get all orders by credit card number. Returns array of {docNumber, docYear, reference}.",
  parameters: z.object({
    creditCardNumber: z.string(),
  }) as z.ZodType<GetComaxOrdersByCreditCardParams>,
  execute: async (args, { log }) => {
    if (!args.creditCardNumber) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide creditCardNumber.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <GetCustomersOrdersByCreditCard xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <CreditCardNumber>${args.creditCardNumber}</CreditCardNumber>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </GetCustomersOrdersByCreditCard>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/GetCustomersOrdersByCreditCard",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let orders: ComaxOrderByCreditCard[] = [];
    let error: string | undefined = undefined;
    let success = false;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["GetCustomersOrdersByCreditCardResponse"];
      const result = response["GetCustomersOrdersByCreditCardResult"];
      if (result) {
        const arr = Array.isArray(result.ClsCustomersOrdersByCreditCard)
          ? result.ClsCustomersOrdersByCreditCard
          : result.ClsCustomersOrdersByCreditCard
          ? [result.ClsCustomersOrdersByCreditCard]
          : [];
        orders = arr.map((o: any) => ({
          docNumber: o.DocNumber?.toString() || "",
          docYear: o.DocYear?.toString() || "",
          reference: o.Reference?.toString() || "",
        }));
        success = true;
      } else {
        error = "No GetCustomersOrdersByCreditCardResult in response.";
      }
    } catch (e) {
      error = `Failed to parse Comax orders by credit card XML: ${e}`;
    }
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch orders by credit card.\n${error || "Unknown error."}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text:
            `Found ${orders.length} orders for credit card.` +
            (orders.length
              ? "\n\n" +
                orders
                  .map(
                    (o, i) =>
                      `${i + 1}. DocNumber: ${o.docNumber}, DocYear: ${o.docYear}, Reference: ${o.reference}`
                  )
                  .join("\n")
              : ""),
        },
      ],
    };
  },
});

server.addTool({
  name: "get_comax_orders_simple",
  description:
    "Get orders by date range and optional filters. Returns a result string (usually XML or CSV).",
  parameters: z.object({
    fromDate: z.string(),
    toDate: z.string(),
    storeID: z.string().optional(),
    departmentID: z.string().optional(),
    agentID: z.string().optional(),
    itemID: z.string().optional(),
    supplierID: z.string().optional(),
    attribute1Code: z.string().optional(),
    attribute2Code: z.string().optional(),
    attribute3Code: z.string().optional(),
    groupByDate: z.string().optional(),
    groupByMonth: z.string().optional(),
    groupBySubGroup: z.string().optional(),
    groupByGroup: z.string().optional(),
    groupByStore: z.string().optional(),
    groupByPrt: z.string().optional(),
    openOrder: z.string().optional(),
    fromDateSupply: z.string().optional(),
    toDateSupply: z.string().optional(),
  }) as z.ZodType<GetComaxOrdersSimpleParams>,
  execute: async (args, { log }) => {
    const soapXml = `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <GetCustomersOrders_Simple xmlns="http://ws.comax.co.il/Comax_WebServices/">\n      <FromDate>${args.fromDate}</FromDate>\n      <ToDate>${args.toDate}</ToDate>\n      <StoreID>${args.storeID || ""}</StoreID>\n      <DepartmentID>${args.departmentID || ""}</DepartmentID>\n      <AgentID>${args.agentID || ""}</AgentID>\n      <ItemID>${args.itemID || ""}</ItemID>\n      <SupplierID>${args.supplierID || ""}</SupplierID>\n      <Attribute1Code>${args.attribute1Code || ""}</Attribute1Code>\n      <Attribute2Code>${args.attribute2Code || ""}</Attribute2Code>\n      <Attribute3Code>${args.attribute3Code || ""}</Attribute3Code>\n      <GroupByDate>${args.groupByDate || ""}</GroupByDate>\n      <GroupByMonth>${args.groupByMonth || ""}</GroupByMonth>\n      <GroupBySubGroup>${args.groupBySubGroup || ""}</GroupBySubGroup>\n      <GroupByGroup>${args.groupByGroup || ""}</GroupByGroup>\n      <GroupByStore>${args.groupByStore || ""}</GroupByStore>\n      <GroupByPrt>${args.groupByPrt || ""}</GroupByPrt>\n      <OpenOrder>${args.openOrder || ""}</OpenOrder>\n      <FromDateSupply>${args.fromDateSupply || ""}</FromDateSupply>\n      <ToDateSupply>${args.toDateSupply || ""}</ToDateSupply>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </GetCustomersOrders_Simple>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/GetCustomersOrders_Simple",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let result: string | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    let rawXml: string | undefined = xml;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["GetCustomersOrders_SimpleResponse"];
      const resStr = response["GetCustomersOrders_SimpleResult"];
      if (resStr) {
        result = resStr;
        success = true;
      } else {
        error = "No GetCustomersOrders_SimpleResult in response.";
      }
    } catch (e) {
      error = `Failed to parse Comax orders simple XML: ${e}`;
    }
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch orders simple.\n${error || "Unknown error."}\n\nRaw XML:\n${rawXml}`,
          },
        ],
      };
    }
    // If result is a URL, fetch and parse the XML
    if (typeof result === "string" && result.startsWith("http")) {
      try {
        const xmlRes = await fetch(result);
        const xmlText = await xmlRes.text();
        const parsed = await parseStringPromise(xmlText, { explicitArray: false });
        const arr = parsed.ArrayOfClsGetCustomersOrdersOut?.ClsGetCustomersOrdersOut;
        let records: Array<{ DocNumber: string; ItemName: string; Quantity: string; TotalSum: string; DateDoc: string }> = [];
        if (Array.isArray(arr)) {
          records = arr.slice(0, 5).map((rec) => ({
            DocNumber: rec.DocNumber,
            ItemName: rec.ItemName,
            Quantity: rec.Quantity,
            TotalSum: rec.TotalSum,
            DateDoc: rec.DateDoc,
          }));
        } else if (arr) {
          records = [{
            DocNumber: arr.DocNumber,
            ItemName: arr.ItemName,
            Quantity: arr.Quantity,
            TotalSum: arr.TotalSum,
            DateDoc: arr.DateDoc,
          }];
        }
      return {
        content: [
          {
            type: "text",
              text: `Orders XML: ${result}\n\nSample records:\n` + JSON.stringify(records, null, 2),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Orders XML: ${result}\n\nFailed to parse XML: ${e}`,
            },
          ],
        };
      }
    }
    return {
      content: [
        {
          type: "text",
          text: `Orders result string:\n\n${result}`,
        },
      ],
    };
  },
});

server.addTool({
  name: "chk_item_exists_in_orders",
  description:
    "Check if an item exists in an order by itemID and orderNumber/orderYear/reference. Returns true if exists, false otherwise.",
  parameters: z.object({
    itemID: z.string().optional(),
    orderNumber: z.string().optional(),
    orderYear: z.string().optional(),
    reference: z.string().optional(),
  }) as z.ZodType<ChkItemExistsInOrdersParams>,
  execute: async (args, { log }) => {
    if (!args.itemID) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide itemID.",
          },
        ],
      };
    }
    if (!args.orderNumber && !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either orderNumber or reference.",
          },
        ],
      };
    }
    const soapXml = `<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <ChkItemExistsInOrders xmlns=\"http://ws.comax.co.il/Comax_WebServices/\">\n      <ItemID>${args.itemID || ""}</ItemID>\n      <OrderNumber>${args.orderNumber || ""}</OrderNumber>\n      <OrderYear>${args.orderYear || ""}</OrderYear>\n      <Reference>${args.reference || ""}</Reference>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </ChkItemExistsInOrders>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
      method: "POST",
          headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/ChkItemExistsInOrders",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let exists: boolean | undefined = undefined;
    let error: string | undefined = undefined;
    let success = false;
    let rawXml: string | undefined = xml;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["ChkItemExistsInOrdersResponse"];
      const result = response["ChkItemExistsInOrdersResult"];
      if (result === "true" || result === true) {
        exists = true;
        success = true;
      } else if (result === "false" || result === false) {
        exists = false;
        success = true;
      } else {
        error = result || "Comax returned invalid result for ChkItemExistsInOrdersResult.";
      }
    } catch (e) {
      error = `Failed to parse Comax ChkItemExistsInOrders XML: ${e}`;
    }
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to check item in orders.\n${error || "Unknown error."}\n\nRaw XML:\n${rawXml}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Item exists in order(s): ${exists ? "true" : "false"}`,
        },
      ],
    };
  },
});

server.addTool({
  name: "set_comax_order_self_pickup",
  description:
    "Set order self-pickup by DocNumber, DocYear, or Reference. Returns true if successful.",
  parameters: z.object({
    docNumber: z.string().optional(),
    docYear: z.string().optional(),
    reference: z.string().optional(),
  }) as z.ZodType<SetComaxOrderSelfPickupParams>,
  execute: async (args, { log }) => {
    if (!args.docNumber && !args.reference) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either docNumber or reference.",
          },
        ],
      };
    }
    const soapXml = `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <SetCustomerOrderSelfPickup xmlns="http://ws.comax.co.il/Comax_WebServices/">\n      <DocNumber>${args.docNumber ? args.docNumber : 0}</DocNumber>\n      <DocYear>${args.docYear ? args.docYear : 0}</DocYear>\n      <Reference>${args.reference ? args.reference : 0}</Reference>\n      <LoginID>${ORDER_LOGIN_ID}</LoginID>\n      <LoginPassword>${ORDER_LOGIN_PASSWORD}</LoginPassword>\n    </SetCustomerOrderSelfPickup>\n  </soap:Body>\n</soap:Envelope>`;
    const res = await fetch(COMAX_ORDER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://ws.comax.co.il/Comax_WebServices/SetCustomerOrderSelfPickup",
      },
      body: soapXml,
    });
    const xml = await res.text();
    let success = false;
    let error: string | undefined = undefined;
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false });
      const body = parsed["soap:Envelope"]["soap:Body"];
      const response = body["SetCustomerOrderSelfPickupResponse"];
      const result = response["SetCustomerOrderSelfPickupResult"];
      if (result === "true" || result === true) {
        success = true;
        } else {
        error = result || "Comax returned false for SetCustomerOrderSelfPickupResult.";
      }
    } catch (e) {
      error = `Failed to parse Comax set order self-pickup XML: ${e}`;
    }
    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to set order self-pickup.\n${error || "Unknown error."}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Order self-pickup updated successfully.`,
        },
      ],
    };
  },
});

server.start({
  transportType: "stdio",
});

console.log("Comax Payment Link MCP server started");
