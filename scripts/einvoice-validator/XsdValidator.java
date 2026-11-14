// ============================================================
// F5.5.4.6.3 — Lokalni uradni XSD validator (UBL 2.1 / e-SLOG).
//
// Uporablja JDK 17 vgrajeni JAXP XML Schema 1.0 validator, ki polno
// podpira XSD 1.0 (vklj. import/include, xs:any lax, dateTime, decimal
// quantifikacijo) — dovolj za UBL 2.1 in e-SLOG 2.0 sheme.
//
// Deterministično lokalno, BREZ spletnega dostopa ob izvajanju:
//   java XsdValidator <xsd-file> <xml-file> [out-json]
//
// Izpiše JSON: {"ok":bool,"errors":[...],"engine":"JDK-JAXP-XSD-1.0","schema":...}
// ============================================================
import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.Schema;
import javax.xml.validation.SchemaFactory;
import javax.xml.validation.Validator;
import org.xml.sax.SAXParseException;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class XsdValidator {
  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      System.out.println("{\"ok\":false,\"errors\":[\"usage: XsdValidator <xsd> <xml> [out]\"]}");
      return;
    }
    String xsd = args[0], xml = args[1];
    StringBuilder errs = new StringBuilder();
    boolean ok;
    try {
      SchemaFactory sf = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
      // UBL/eSLOG sheme se deterministično razrešujejo lokalno prek base URI.
      File xsdFile = new File(xsd);
      Schema schema = sf.newSchema(new StreamSource(new FileInputStream(xsdFile), xsdFile.toURI().toString()));
      Validator v = schema.newValidator();
      v.setErrorHandler(new org.xml.sax.ErrorHandler() {
        public void warning(SAXParseException e) { errs.append("W:").append(e.getMessage()).append(" @").append(e.getLineNumber()).append(";"); }
        public void error(SAXParseException e) { errs.append("E:").append(e.getMessage()).append(" @").append(e.getLineNumber()).append(";"); }
        public void fatalError(SAXParseException e) { errs.append("F:").append(e.getMessage()).append(" @").append(e.getLineNumber()).append(";"); }
      });
      v.validate(new StreamSource(new FileInputStream(xml)));
      ok = (errs.length() <= 0);
    } catch (Exception e) {
      errs.append("X:").append(e.getMessage());
      ok = false;
    }
    String out = "{\"ok\":" + ok + ",\"errors\":[\"" + errs.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"],"
      + "\"engine\":\"JDK-JAXP-XSD-1.0\",\"schema\":\"" + xsd.replace("\\", "\\\\") + "\"}";
    if (args.length >= 3) {
      try (Writer w = new OutputStreamWriter(new FileOutputStream(args[2]), StandardCharsets.UTF_8)) { w.write(out); }
    }
    System.out.println(out);
  }
}