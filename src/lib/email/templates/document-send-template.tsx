import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"

// ============================================================
// E-poštna predloga za pošiljanje dokumenta (ponudba/račun/dobropis).
// Priloga (PDF) je dodana na ravni pošiljatelja (sendEmail), ne v HTML.
// ============================================================

export function DocumentSendTemplate({
  docCode,
  doctype,
  customerName,
  issuerName,
  totalLabel,
}: {
  docCode: string
  doctype: string
  customerName: string
  issuerName: string
  totalLabel: string
}) {
  const typeLabel = doctype === "INVOICE" ? "račun" : doctype === "CREDIT" ? "dobropis" : "ponudba"
  return (
    <Html>
      <Head />
      <Preview>Vaš dokument {docCode} — {issuerName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Vaš {typeLabel} {docCode}</Heading>
          <Text style={text}>Pozdravljeni, {customerName || "stranka"}.</Text>
          <Text style={text}>
            V prilogi je dokument <strong>{docCode}</strong> v formatu PDF.
            {totalLabel ? <> Skupni znesek: <strong>{totalLabel}</strong>.</> : null}
          </Text>
          <Section style={box}>
            <Row>
              <Column><Text style={muted}>Izdajatelj</Text></Column>
              <Column><Text>{issuerName}</Text></Column>
            </Row>
          </Section>
          <Text style={muted}>Ta e-pošta je bila ustvarjena samodejno. Ne odgovarjajte nanjo.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: "#f8f8f8", fontFamily: "-apple-system, Segoe UI, Roboto, Arial, sans-serif" }
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "24px", maxWidth: "560px", borderRadius: "8px", border: "1px solid #eee" }
const heading = { fontSize: "20px", lineHeight: "1.3", color: "#111" }
const text = { fontSize: "14px", lineHeight: "1.5", color: "#333" }
const box = { backgroundColor: "#f5f5f5", padding: "12px", borderRadius: "6px", marginTop: "16px" }
const muted = { fontSize: "12px", color: "#888" }