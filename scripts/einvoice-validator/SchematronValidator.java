// ============================================================
// F5.5.4.6.3 — Lokalni uradni Schematron validator (PEPPOL / CEN / e-SLOG).
//
// Izvaja ISO Schematron (ISO/IEC 19757-3) prek uradne knjižnice iso-schematron
// XSLT (Schematron.org) + Saxon-HE.
//
//   java -cp "path/Saxon-HE-12.5.jar;." SchematronValidator \
//        <iso-xslt-dir> <sch-file> <xml-file> [out-json]
//
// Potek: sch --iso_dsdl_include--> t1 --iso_abstract_expand--> t2
//        t2 --iso_svrl_for_xslt2--> compiled.xsl
//        xml --compiled.xsl--> SVRL
// Povzetek SVRL: število failed-assert / successful + seznam sporočil (id, text).
// Deterministično lokalno, brez spletnega dostopa pri izvajanju.
// ============================================================
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.XsltCompiler;
import net.sf.saxon.s9api.XsltExecutable;
import net.sf.saxon.s9api.XsltTransformer;
import net.sf.saxon.s9api.DocumentBuilder;
import net.sf.saxon.s9api.XdmNode;
import net.sf.saxon.s9api.Serializer;
import net.sf.saxon.s9api.QName;
import javax.xml.transform.stream.StreamSource;
import org.xml.sax.InputSource;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

public class SchematronValidator {
  static String slurp(Path p) throws IOException { return new String(Files.readAllBytes(p), StandardCharsets.UTF_8); }

  static Path transform(Processor proc, Path xslt, Path input, Path output) throws Exception {
    XsltCompiler comp = proc.newXsltCompiler();
    XsltExecutable exe = comp.compile(new StreamSource(xslt.toFile()));
    XsltTransformer tr = exe.load();
    DocumentBuilder db = proc.newDocumentBuilder();
    XdmNode node = db.build(new StreamSource(input.toFile()));
    tr.setInitialContextNode(node);
    Serializer ser = proc.newSerializer(output.toFile());
    ser.setOutputProperty(Serializer.Property.METHOD, "xml");
    tr.setDestination(ser);
    tr.transform();
    return output;
  }

  public static void main(String[] args) throws Exception {
    if (args.length < 3) {
      System.out.println("{\"ok\":false,\"errors\":[\"usage: SchematronValidator <iso-xslt-dir> <sch> <xml> [out]\"]}");
      return;
    }
    Path isoDir = Paths.get(args[0]);
    Path sch = Paths.get(args[1]);
    Path xml = Paths.get(args[2]);

    Path tmp = Files.createTempDirectory("sch-");
    Path t1 = tmp.resolve("t1.xsl");
    Path t2 = tmp.resolve("t2.xsl");
    Path compiled = tmp.resolve("compiled.xsl");
    Path svrl = tmp.resolve("svrl.xml");

    StringBuilder errs = new StringBuilder();
    boolean ok = false;
    String violationSummary = "";
    try {
      Processor proc = new Processor(false); // XSLT 2.0 (Saxon-HE)
      // 1) include dsdl
      transform(proc, isoDir.resolve("iso_dsdl_include.xsl"), sch, t1);
      // 2) abstract expand
      transform(proc, isoDir.resolve("iso_abstract_expand.xsl"), t1, t2);
      // 3) compile to validation XSLT (SVRL for XSLT2)
      transform(proc, isoDir.resolve("iso_svrl_for_xslt2.xsl"), t2, compiled);
      // 4) run over instance -> SVRL
      transform(proc, compiled, xml, svrl);
      ok = true;
      violationSummary = summarize(svrl);
    } catch (Exception e) {
      errs.append("X:").append(e.getClass().getSimpleName()).append(":").append(e.getMessage());
      ok = false;
    }
    // ok = proces uspel; skladnost = ni failed asserts v SVRL
    String out = "{\"ran\":\"" + ok + "\",\"violations\":" + (ok ? violationCount(violationSummary) : "0")
      + ",\"summary\":\"" + esc(violationSummary) + "\",\"errors\":[\"" + esc(errs.toString()) + "\"],"
      + "\"engine\":\"ISO-Schematron-XSLT2+Saxon-HE-12.5\",\"schema\":\"" + esc(sch.getFileName().toString()) + "\"}";
    if (args.length >= 4) {
      try (Writer w = new OutputStreamWriter(new FileOutputStream(args[3]), StandardCharsets.UTF_8)) { w.write(out); }
    }
    System.out.println(out);
  }

  static int violationCount(String summary) {
    if (summary == null || summary.trim().isEmpty()) return 0;
    // summary je JSON array string kot "[{...},{...}]"; štejemo pojavitve 'failed'
    int n = 0, i = 0;
    String low = summary.toLowerCase();
    while ((i = low.indexOf("failed", i)) != -1) { n++; i += 6; }
    return n;
  }

  static String esc(String s) {
    return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  /** Parsira SVRL in vrne kompaktno JSON array z failed-assert (id, text, location). */
  static String summarize(Path svrl) throws Exception {
    String s = new String(Files.readAllBytes(svrl), StandardCharsets.UTF_8);
    // Izvlečemo <svrl:failed-assert> bloke
    StringBuilder sb = new StringBuilder("[");
    int cnt = 0;
    int idx = 0;
    while (true) {
      int fs = s.indexOf("<svrl:failed-assert", idx);
      if (fs < 0) { int fs2 = s.indexOf("<failed-assert", idx); if (fs2 < 0) break; fs = fs2; }
      int fe = s.indexOf("</svrl:failed-assert>", fs);
      if (fe < 0) { fe = s.indexOf("</failed-assert>", fs); if (fe < 0) break; fe += "</failed-assert>".length(); }
      else fe += "</svrl:failed-assert>".length();
      String block = s.substring(fs, fe);
      if (cnt > 0) sb.append(",");
      sb.append("{")
        .append("\"text\":\"").append(esc(tag(block, "sch:text", "sch:text", "name", "diagnostic-reference", "location"))).append("\"")
        .append(",\"location\":\"").append(esc(attr(block, "location"))).append("\"")
        .append(",\"flag\":\"").append(esc(attr(block, "flag", "f"))).append("\"");
      String id = attr(block, "id");
      if (!id.isEmpty()) sb.append(",\"id\":\"").append(esc(id)).append("\"");
      sb.append("}");
      cnt++;
      idx = fe;
    }
    sb.append("]");
    return sb.toString();
  }

  static String tag(String block, String open, String close, String... others) {
    // poišči prvi vsebinski pod-element po imenu; vrni njegovo text vsebino
    int o = block.indexOf("<" + open);
    if (o < 0) o = block.indexOf("<sch:text");
    if (o < 0) return "";
    int c = block.indexOf(">", o);
    if (c < 0) return "";
    int closeIdx = block.indexOf("</" + close + ">", c);
    if (closeIdx < 0) closeIdx = block.indexOf("</sch:text>", c);
    if (closeIdx < 0) return "";
    return stripXml(block.substring(c + 1, closeIdx));
  }

  static String attr(String block, String name, String... alt) {
    String patt = name + "=\"";
    int o = block.indexOf(patt);
    if (o < 0) {
      for (String a : alt) { o = block.indexOf(a + "=\""); if (o >= 0) break; }
      if (o < 0) return "";
      patt = block.substring(o).split("=")[0] + "=\"";
    }
    int q = block.indexOf("\"", o + patt.length());
    return q < 0 ? "" : block.substring(o + patt.length(), q);
  }

  static String stripXml(String s) {
    return s.replaceAll("\\s+", " ").trim();
  }
}