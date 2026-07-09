import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { cellToString } from '../domain/csv';

/**
 * Documento PDF do export de relatório (T11 — E-002, TD §5). Componente puro
 * (sem IO) consumido por `renderToBuffer` na Server Action `exportReport`.
 * Mesmo watermark do CSV (T4 — `composeWatermark`), agora no cabeçalho da
 * página em vez da 1ª linha de texto (REL42-MN-01).
 */

export interface ReportPdfColumn {
  key: string;
  label: string;
}

export interface ReportPdfProps {
  title: string;
  columns: readonly ReportPdfColumn[];
  rows: readonly Record<string, unknown>[];
  /** Presente quando o relatório tem PII (REL42-MN-01) — vira o cabeçalho da página. */
  watermark?: string;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: 'Helvetica' },
  watermark: { fontSize: 9, color: '#b91c1c', marginBottom: 10 },
  title: { fontSize: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 3 },
  headerCell: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  cell: { flex: 1, fontSize: 9 },
  empty: { fontSize: 10, marginTop: 8, fontStyle: 'italic' },
});

/**
 * `title` + tabela `columns`/`rows`. `rows=[]` renderiza só cabeçalho +
 * aviso "sem dados no período" — nunca lança (período vazio do epic spec).
 */
export function ReportPdfDocument({ title, columns, rows, watermark }: ReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {watermark ? <Text style={styles.watermark}>{watermark}</Text> : null}
        <Text style={styles.title}>{title}</Text>

        <View style={styles.headerRow}>
          {columns.map((column) => (
            <Text key={column.key} style={styles.headerCell}>
              {column.label}
            </Text>
          ))}
        </View>

        {rows.length === 0 ? (
          <Text style={styles.empty}>Sem dados no período selecionado.</Text>
        ) : (
          rows.map((row, index) => (
            <View key={index} style={styles.row}>
              {columns.map((column) => (
                <Text key={column.key} style={styles.cell}>
                  {cellToString(row[column.key])}
                </Text>
              ))}
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
