export interface ComaxOrderItem {
  sku: string;
  quantity: number;
  price: number;
  totalSum: number;
  remarks?: string;
}

export interface CreateComaxPaymentLinkParams {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  customerZip?: string;
  priceListId?: number;
  items: ComaxOrderItem[];
  reference?: string;
  remarks?: string;
}

export interface CreateComaxPaymentLinkResult {
  docNumber: string;
  paymentLink: string;
}

export interface UpdateComaxOrderPaymentParams {
  docNumber: string;
  customerId?: string;
  storeId?: number;
  branchId?: number;
  priceListId?: number;
  payType: string;
  creditTokenNumber: string;
  creditCompany: string;
  creditCardNumber: string;
  creditExpireDate: string;
  creditTZ: string;
  creditPaysNumber: string;
  creditTransactionType: string;
  items: ComaxOrderItem[];
  remarks?: string;
}

export interface UpdateComaxOrderPaymentResult {
  success: boolean;
  message: string;
}

export interface GetComaxCustomerDetailsParams {
  customerId: string;
}

export interface ComaxContactMan {
  CustomerID: string;
  Name: string;
  Title?: string;
  Phone?: string;
  Mobile?: string;
  Fax?: string;
  Email?: string;
}

export interface ComaxCustomerDetails {
  InternalID: string;
  Name: string;
  ID: string;
  Street?: string;
  Street_No?: string;
  City?: string;
  Phone?: string;
  Zip?: string;
  Mobile?: string;
  Currency?: string;
  GroupID?: string;
  TypeID?: string;
  TaxID?: string;
  ForeignName?: string;
  ForeignCity?: string;
  ForeignCurrency?: boolean;
  ExportCustomer?: boolean;
  TaxExempt?: string;
  IDCard?: string;
  Email?: string;
  NotSendEmail?: boolean;
  NotSendSMS?: boolean;
  BornDate?: string;
  DateOfBirth?: string;
  FamilyStatus?: string;
  Sex?: string;
  PriceListID?: string;
  DiscountPercent?: string;
  Remark?: string;
  Floor?: string;
  Flat?: string;
  Balance?: string;
  BalanceLk?: string;
  IsBlocked?: boolean;
  BlockDate?: string;
  ContactMan?: ComaxContactMan | ComaxContactMan[];
  ClubCustomer?: boolean;
  SwInvoiceEmail?: boolean;
  SwDeleteBlockDate?: boolean;
  CentralAccount?: string;
  EDI?: string;
  CheckIdDetailsExists?: boolean;
  AgentId?: string;
  CreditLimit?: string;
}

export interface GetComaxCustomerDetailsResult {
  success: boolean;
  customer?: ComaxCustomerDetails;
  rawXml?: string;
  error?: string;
}

export interface GetComaxOrderStatusParams {
  docNumber?: string; // can be string or number, optional if using reference
  reference?: string; // can be string or number, optional if using docNumber
}

export interface ComaxOrderStatusResult {
  StatusCode: number;
  StatusName: string;
  TrackingNumber?: string;
  ErrorMessage?: string;
  SelfSupply?: boolean;
  CloseOrder?: number;
  SwClose?: number;
  DeliveryStore?: number;
  DocNumber?: string;
}

export interface GetComaxOrderStatusResult {
  success: boolean;
  status?: ComaxOrderStatusResult;
  rawXml?: string;
  error?: string;
}

export interface GetComaxOrderDetailsParams {
  docNumber?: string;
  docYear?: string;
  reference?: string;
}

export interface ComaxOrderDetailsResult {
  CustomerID?: string;
  StoreID?: number;
  PriceListID?: number;
  AgentID?: number;
  DocNumber?: string;
  ManualDocNumber?: boolean;
  Reference?: string;
  TotalSum?: number;
  TotalQuantity?: string;
  LinesCount?: string;
  Remarks?: string;
  Details?: string;
  Status?: number;
  Customer?: any; // TODO: type this if needed
  Err?: any;
  [key: string]: any;
}

export interface GetComaxOrderDetailsResult {
  success: boolean;
  details?: ComaxOrderDetailsResult;
  rawXml?: string;
  error?: string;
}

export interface GetComaxOrderPDFLinkParams {
  docNumber?: string;
  reference?: string;
  docYear?: string;
  swBySpool?: boolean;
}

export interface GetComaxOrderPDFLinkResult {
  success: boolean;
  pdfUrl?: string;
  rawXml?: string;
  error?: string;
}

export interface SetComaxOrderStatusParams {
  docNumber?: string;
  docYear?: string;
  reference?: string;
  status?: string;
  statusCode?: number;
}

export interface SetComaxOrderStatusResult {
  success: boolean;
  rawXml?: string;
  error?: string;
}

export interface GetComaxOrdersByCreditCardParams {
  creditCardNumber: string;
}

export interface ComaxOrderByCreditCard {
  docNumber: string;
  docYear: string;
  reference: string;
}

export interface GetComaxOrdersByCreditCardResult {
  success: boolean;
  orders?: ComaxOrderByCreditCard[];
  rawXml?: string;
  error?: string;
}

export interface GetComaxOrdersSimpleParams {
  fromDate: string;
  toDate: string;
  storeID?: string;
  departmentID?: string;
  agentID?: string;
  itemID?: string;
  supplierID?: string;
  attribute1Code?: string;
  attribute2Code?: string;
  attribute3Code?: string;
  groupByDate?: string;
  groupByMonth?: string;
  groupBySubGroup?: string;
  groupByGroup?: string;
  groupByStore?: string;
  groupByPrt?: string;
  openOrder?: string;
  fromDateSupply?: string;
  toDateSupply?: string;
}

export interface GetComaxOrdersSimpleResult {
  success: boolean;
  result?: string;
  rawXml?: string;
  error?: string;
}

export interface ChkItemExistsInOrdersParams {
  itemID?: string;
  orderNumber?: string;
  orderYear?: string;
  reference?: string;
}

export interface ChkItemExistsInOrdersResult {
  success: boolean;
  exists?: boolean;
  rawXml?: string;
  error?: string;
}

export interface SetComaxOrderSelfPickupParams {
  docNumber?: string;
  docYear?: string;
  reference?: string;
}

export interface SetComaxOrderSelfPickupResult {
  success: boolean;
  rawXml?: string;
  error?: string;
}
