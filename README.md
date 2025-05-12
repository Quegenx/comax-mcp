# Comax Payment Link MCP

A FastMCP server for integrating with Comax to create payment links, manage orders, and retrieve customer information. Built with [FastMCP](https://github.com/punkpeye/fastmcp), a TypeScript framework for MCP servers.

> [!NOTE]
>
> This server is designed to interface with the Comax ERP/payment system.

## Features

- **Comax Integration:** Provides tools for key Comax operations.
- **FastMCP Core:** Leverages FastMCP for robust MCP server functionality including:
    - Simple Tool definition with Zod schema validation
    - Session management
    - Logging and Error handling
    - SSE for remote communication (configurable)
    - CORS (enabled by default)
    - Progress notifications (for long-running tools, if implemented)
    - Typed server events
    - CLI for testing and debugging

## Installation

Ensure you have Node.js and pnpm (or npm/yarn) installed.

```bash
# Clone the repository (if you haven't already)
# git clone <your-repo-url>
# cd <your-repo-name>

# Install dependencies
pnpm install
```

## Configuration

This server requires several credentials and IDs to interact with the Comax API. These are currently hardcoded as constants in `src/index.ts` but should ideally be configured via environment variables for production use.

**Required Configuration (see `src/index.ts`):**
- `ORDER_LOGIN_ID`, `ORDER_LOGIN_PASSWORD`: For Comax order operations.
- `TOKEN_LOGIN_NAME`, `TOKEN_LOGIN_PASSWORD`: For Comax credit token generation.
- `PAYMENT_LOGIN_ID`, `PAYMENT_LOGIN_PASSWORD`: For the Comax payment page.
- `BRANCH_ID`, `STORE_ID`, `PRICE_LIST_ID`: Default Comax operational IDs.
- `RETURN_PAGE`: URL for redirection after payment.
- `COMAX_ORDER_ENDPOINT`, `COMAX_TOKEN_ENDPOINT`, `COMAX_PAYMENT_PAGE`, `COMAX_CUSTOMER_ENDPOINT`: Comax API endpoint URLs.

Consider using a library like `dotenv` to manage these in a `.env` file for local development.

## Quickstart

The following is a simplified example of how a tool is defined in this server (`src/index.ts`):

```typescript
import { FastMCP } from "fastmcp";
import { z } from "zod"; // Using Zod for schema validation

const server = new FastMCP({
  name: "Comax Payment Link MCP",
  version: "1.0.0",
});

// Example: Create Comax Payment Link Tool
server.addTool({
  name: "create_comax_payment_link",
  description: "Creates a Comax order and returns a payment link.",
  parameters: z.object({
    customerId: z.string().default("22222"),
    customerName: z.string(),
    customerPhone: z.string(),
    customerCity: z.string(),
    items: z.array(z.object({ // Simplified item schema
      sku: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      totalSum: z.number().positive(),
    })).min(1),
    // ... other parameters
  }),
  execute: async (args, { log }) => {
    log.info("Attempting to create Comax payment link for", args.customerName);
    // ... logic to call Comax API ...
    const paymentUrl = "https://example-payment-url.com/pay?token=XYZ"; // Placeholder
    log.info("Payment link created successfully.");
    return {
      content: [
        {
          type: "text",
          text: `Comax payment link created.\nOrder DocNumber: 12345\nPayment Link: ${paymentUrl}`,
        },
      ],
    };
  },
});

server.start({
  transportType: "stdio", // Or "sse" for network access
});

console.log("Comax Payment Link MCP server started");
```

You can test the server in the terminal using the FastMCP CLI.

## Available Tools

This server exposes the following tools for interacting with Comax:

- **`create_comax_payment_link`**: Creates a Comax order and returns a payment link.
- **`update_comax_order_payment`**: Updates a Comax order with payment confirmation.
- **`get_comax_customer_details`**: Fetches Comax business customer details by CustomerID.
- **`get_comax_order_status`**: Retrieves the status of a Comax order by DocNumber or Reference.
- **`get_comax_order_details`**: Gets detailed information for a Comax order.
- **`get_comax_order_pdf_link`**: Gets a PDF link for a Comax order.
- **`set_comax_order_status`**: Sets the status of a Comax order.
- **`get_comax_orders_by_credit_card`**: Fetches orders associated with a credit card number.
- **`get_comax_orders_simple`**: Retrieves orders based on a date range and optional filters. If the result is an XML URL, it fetches and provides a sample of records.
- **`chk_item_exists_in_orders`**: Checks if a specific item exists in an order.
- **`set_comax_order_self_pickup`**: Marks a Comax order for self-pickup.

Refer to `src/index.ts` for the exact parameters and implementation details of each tool.

## Core Concepts (FastMCP)

### Tools

[Tools](https://modelcontextprotocol.io/docs/concepts/tools) in MCP allow servers to expose executable functions that can be invoked by clients (like AI models or other applications) to perform actions. This server uses tools to interact with the Comax API.

FastMCP uses the [Standard Schema](https://standardschema.dev) specification for defining tool parameters. This server primarily uses Zod for this purpose.

**Tool Definition Example (Zod):**

```typescript
import { z } from "zod";

server.addTool({
  name: "example_comax_tool",
  description: "An example tool description.",
  parameters: z.object({
    someParameter: z.string().describe("Description for the parameter"),
    // ... other parameters
  }),
  execute: async (args, { log, reportProgress }) => {
    log.info("Executing example_comax_tool with", args);
    // Your tool logic here - e.g., call Comax API
    // reportProgress({ progress: 50, total: 100 }); // Optional progress reporting
    return {
      content: [{ type: "text", text: "Tool execution finished." }],
    };
  },
});
```

#### Logging & Error Handling

-   **Logging:** Tools can use `log.info()`, `log.warn()`, etc., from the `execute` context to send log messages.
-   **User Errors:** Throw `UserError` from `fastmcp` for errors intended to be shown to the end-user.
-   **Progress:** Use `reportProgress` for long-running operations.

### Sessions

FastMCP allocates a new server instance for each client connection, enabling 1:1 communication. Session-specific data can be accessed if authentication is configured on the FastMCP server (not to be confused with Comax API authentication, which is handled per-request within the tools).

## Running Your Server

### Test with `mcp-cli`

The fastest way to test and debug your server is with `fastmcp dev`:

```bash
# Ensure you are in the project root directory
npx fastmcp dev src/index.ts
```

This will run your server with [`mcp-cli`](https://github.com/wong2/mcp-cli) for testing and debugging your MCP server in the terminal.

### Inspect with `MCP Inspector`

Another way is to use the official [`MCP Inspector`](https://modelcontextprotocol.io/docs/tools/inspector) to inspect your server with a Web UI:

```bash
npx fastmcp inspect src/index.ts
```

### Running with SSE for Network Access

To make the server accessible over the network (e.g., for a remote client or Smithery):

```typescript
// In src/index.ts, modify server.start:
server.start({
  transportType: "sse",
  sse: {
    endpoint: "/sse", // Or your desired endpoint
    port: 8080,       // Or your desired port
  },
});
```
Then run `node src/index.js` (after compiling TS to JS, e.g., with `tsc`) or use `tsx` for direct execution: `npx tsx src/index.ts`.

## FAQ

### How to use with Claude Desktop (or similar MCP clients)?

Follow the general guide at [https://modelcontextprotocol.io/quickstart/user](https://modelcontextprotocol.io/quickstart/user) and configure the MCP client to launch your server.

**Example `mcp_config.json` entry:**

```json
{
  "mcpServers": {
    "comax-gimo-mcp": {
      "command": "npx",
      "args": [
        "tsx",
        "/FULL/PATH/TO/YOUR/gimo-mcp/src/index.ts" // Replace with the absolute path
      ],
      "env": {
        // If you move Comax credentials to environment variables, define them here:
        // "ORDER_LOGIN_ID": "your_order_login_id",
        // "ORDER_LOGIN_PASSWORD": "your_order_login_password",
        // ... and so on for all required credentials/configs
      }
    }
  }
}
```
Ensure the path to `src/index.ts` is correct and that any necessary environment variables (if you choose to use them over constants) are set.

## Smithery Integration

This project is intended to be integrated with Smithery to facilitate automated code improvements, testing, and deployment workflows via GitHub pull requests. Smithery will require appropriate GitHub permissions to create branches and propose changes.

## Acknowledgements

- This server is built using [FastMCP](https://github.com/punkpeye/fastmcp).
- FastMCP is inspired by the [Python implementation](https://github.com/jlowin/fastmcp) by [Jonathan Lowin](https://github.com/jlowin).
- Parts of FastMCP's codebase were adopted from [LiteMCP](https://github.com/wong2/litemcp) and [Model Context protocolでSSEをやってみる](https://dev.classmethod.jp/articles/mcp-sse/).
