// ============================================================
// F5.5.4.6.4 — PEPPOL AS4 / ebMS3: gradnja User Message + SBDH + multipart.
//
// Po OpenPeppol AS4 Profile 2.0.3 (docs.peppol.eu/edelivery/as4/specification/),
// grajeno na CEF eDelivery AS4 Profile 1.14. Ta modul sestavi DETERMINISTIČNI
// AS4 prenosni paket (ni omrežja) — SOAP 1.2 ovojnico z eb:UserMessage glavo,
// SBDH kot prvo MIME prilogo, dokument kot drugo, in multipart/related telesom.
//
// POŠTENO O OBSEGU:
//  • To NI pošiljanje v Peppol omrežje. Dejanska oddaja zahteva registriran
//    Access Point (TIA-AP-PROV + Peppol PKI cert) ali zunanji testni AP
//    (GoRoute sandbox, lokalni Oxalis). Tukaj se zgradi in preveri plast, ki je
//    deterministična in preverljiva brez omrežja.
//  • Podpis/šifriranje na AS4 nivoju (wsse:Security + BinarySecurityToken X509v3,
//    XMLDSig nad SOAP Body + payload) smo izpuskali takrat, ko ni pravega AP certa;
//    to je označeno kot `signature: false` in se vklopi ob dejanskem AP.
// ============================================================

const NS_SOAP = "http://www.w3.org/2003/05/soap-envelope"
const NS_EB = "http://docs.oasis-open.org/ebxml-msg/ebms/v3.0/ns/core/200704/"
const NS_WSSE = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
const NS_EB_XSI = "http://www.w3.org/2001/XMLSchema-instance"

/** Pauddifno UPI (service@action·role) za posredovanje računov — po profilu. */
export interface As4Routing {
  sendingPartyId: string   // shema iso6523-actorid-upis
  receivingPartyId: string // shema iso6523-actorid-upis
  service: string          // npr. urn:fdc:peppol.eu:2017:poacc:billing:3.0::Invoice
  action: string           // npr. urn:fdc:peppol.eu:2017:poacc:billing:3.0::3.0
  role: string             // npr. urn:fdc:peppol.eu:2017:roles:ap_provider
}

export interface As4BuildOptions extends As4Routing {
  documentXml: string
  /** Base64 PEM X509 (vključi se v BinarySecurityToken). Brez njega `signature:false`. */
  certPem?: string
  /** ConversationId (deterministično-unikaten), privzeto iz docCode + čas. */
  conversationId?: string
  /** idempotentni MessageId; privzeto UUID@org. */
  messageId?: string
}

export interface As4BuildResult {
  /** SOAP 1.2 ovojnica (je/UserMessage) — prva MIME priloga. */
  soapEnvelope: string
  /** SBDH (StandardBusinessDocumentHeader) — priložena pred dokumentom. */
  sbhXml: string
  /** POSLANI Content-Type (multipart/related + boundary). */
  contentType: string
  /** Celotno multipart/related telo (za HTTP POST / AS4). */
  multipartBody: string
  routing: As4Routing
}

/** Pod fiksnim AgreementRefom (TIA AP Provider) — kot ga zahteva Peppol AS4. */
export const AGREEMENT_REF = "urn:fdc:peppol.eu:2017:agreements:tia:ap_provider"
export const DEFAULT_MPC = "urn:fdc:peppol.eu:2017:mpc:default"
export const NS_ROLE_AP = "urn:fdc:peppol.eu:2017:roles:ap_provider"

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** StandardBusinessDocumentHeader — prva MIME priloga v skladu z ebXML BPSS/SBDH. */
export function buildSbh(routing: Pick<As4Routing, "sendingPartyId" | "receivingPartyId">, documentId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<StandardBusinessDocument xmlns="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">
  <StandardBusinessDocumentHeader>
    <HeaderVersion>1.0</HeaderVersion>
    <Sender>
      <Identifier Authority="iso6523-actorid-upis">${escXml(routing.sendingPartyId)}</Identifier>
    </Sender>
    <Receiver>
      <Identifier Authority="iso6523-actorid-upis">${escXml(routing.receivingPartyId)}</Identifier>
    </Receiver>
    <DocumentIdentification>
      <Standard>PEPPOL-BIS</Standard>
      <TypeVersion>3.0</TypeVersion>
      <InstanceIdentifier>${escXml(documentId)}</InstanceIdentifier>
      <Type>Invoice</Type>
      <MultipleType>false</MultipleType>
      <CreationDateAndTime>${new Date().toISOString()}</CreationDateAndTime>
    </DocumentIdentification>
    <Manifest>
      <NumberOfItems>1</NumberOfItems>
      <ManifestItem>
        <MimeType>application/xml</MimeType>
        <LoadedObject>cid:document</LoadedObject>
        <Description>Peppol invoice</Description>
      </ManifestItem>
    </Manifest>
  </StandardBusinessDocumentHeader>
</StandardBusinessDocument>`
}

/**
 * SOAP 1.2 ovojnica z eb:UserMessage (AS4). Vključi eb:PartyId provider/consumer
 * z običajno shemo `iso6523-actorid-upis` ter Service/Action/Role po profilu.
 * Telo (Body) pri vSE 4-V4 AS4 nosi le referenco/primitivni element — dejanski
 * dokument je v MIME prilogi (cid:payload).
 */
export function buildSoapEnvelope(r: As4Routing & { certPem?: string; messageId?: string; conversationId?: string }): string {
  const convId = r.conversationId ?? r.messageId ?? `${r.sendingPartyId}-${Date.now()}`
  const msgId = r.messageId ?? convId
  const roleConsumer = "urn:fdc:peppol.eu:2017:roles:ap_role_consumer"
  // Main/Qualified MessageId (poročilu po poslani prvo UPI servisa).
  const securityToken = r.certPem
    ? `<wsse:BinarySecurityToken ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
      EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" wsu:Id="cert">
      ${r.certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, "").replace(/\s+/g, "")}</wsse:BinarySecurityToken>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${NS_SOAP}" xmlns:eb="${NS_EB}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:wsse="${NS_WSSE}" xmlns:xsi="${NS_EB_XSI}">
  <soap:Header>
    <eb:Messaging>
      <eb:SignalMessage>
        <eb:MessageInfo>
          <eb:Timestamp>${new Date().toISOString()}</eb:Timestamp>
          <eb:MessageId>${escXml(msgId)}</eb:MessageId>
        </eb:MessageInfo>
      </eb:SignalMessage>
      <eb:UserMessage>
        <eb:MessageInfo>
          <eb:Timestamp>${new Date().toISOString()}</eb:Timestamp>
          <eb:MessageId>${escXml(msgId)}</eb:MessageId>
        </eb:MessageInfo>
        <eb:PartyInfo>
          <eb:From><eb:PartyId type="urn:fdc:peppol.eu:2017:identifiers:party-id-type:iso6523">${escXml(r.sendingPartyId)}</eb:PartyId><eb:Role>${escXml(r.role)}</eb:Role></eb:From>
          <eb:To><eb:PartyId type="urn:fdc:peppol.eu:2017:identifiers:party-id-type:iso6523">${escXml(r.receivingPartyId)}</eb:PartyId><eb:Role>${escXml(roleConsumer)}</eb:Role></eb:To>
          <eb:PartyId type="urn:fdc:peppol.eu:2017:identifiers:party-id-type:iso6523">${escXml(r.sendingPartyId)}</eb:PartyId>
        </eb:PartyInfo>
        <eb:CollaborationInfo>
          <eb:AgreementRef>${escXml(AGREEMENT_REF)}</eb:AgreementRef>
          <eb:Service>${escXml(r.service)}</eb:Service>
          <eb:Action>${escXml(r.action)}</eb:Action>
          <eb:ConversationId>${escXml(convId)}</eb:ConversationId>
        </eb:CollaborationInfo>
        <eb:MessageProperties>
          <eb:Property name="originalSender" type="string" value="${escXml(r.sendingPartyId)}"/>
          <eb:Property name="finalRecipient" type="string" value="${escXml(r.receivingPartyId)}"/>
          <eb:Property name="payloadProfileId" type="string" value="urn:fdc:peppol.eu:2017:poacc:billing:3.0"/>
        </eb:MessageProperties>
        <eb:PayloadInfo>
          <eb:PartInfo href="#payload" />
        </eb:PayloadInfo>
        <eb:Security>
          ${securityToken}
        </eb:Security>
      </eb:UserMessage>
    </eb:Messaging>
  </soap:Header>
  <soap:Body>
    <eb:Payload href="cid:payload" />
  </soap:Body>
</soap:Envelope>`
}

/**
 * Sestavi poln multipart/related paket (SOAP ovojnica + SBDH + dokument).
 * Vrne Content-Type in telo za HTTP POST AS4 (poštni tip PEPPOL AS4).
 */
export function buildAs4Multipart(r: As4BuildOptions): As4BuildResult {
  const soap = buildSoapEnvelope(r)
  const sbh = buildSbh(r, r.messageId ?? "doc")
  // Enak boundary (N2k) uporabljamo na obeh straneh.
  const boundary = "BSD_" + Math.random().toString(36).slice(2, 14)
  const contentType = `multipart/related; type="application/soap+xml"; boundary="${boundary}"`
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/soap+xml\r\n` +
    `Content-ID: <soap>\r\n\r\n` +
    soap +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/xml\r\n` +
    `Content-ID: <sbh>\r\n\r\n` +
    sbh +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/xml\r\n` +
    `Content-ID: <payload>\r\n\r\n` +
    r.documentXml +
    `\r\n--${boundary}--\r\n`
  return { soapEnvelope: soap, sbhXml: sbh, contentType, multipartBody: body, routing: r }
}