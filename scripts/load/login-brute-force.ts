/**
 * Carga sintética para o ensaio D-001 (USP-004 — T-12). **Manual, não-CI.**
 *
 * Demonstra empiricamente o lockout `(email, ip)` (ADR-0029): dispara N
 * tentativas de senha errada para a mesma Pessoa, variando o IP sintético via
 * `x-forwarded-for`. Espera-se que, por IP, as 5 primeiras tentativas cheguem
 * ao provedor e da 6ª em diante a resposta seja o bloqueio transparente (mesma
 * mensagem genérica), enquanto IPs distintos seguem independentes.
 *
 * ⚠️  Use APENAS contra o ambiente local (`supabase start` + `npm run dev`).
 *     Não aponte para staging/produção — gera tentativas de login reais.
 *
 * Uso:
 *   npx tsx scripts/load/login-brute-force.ts \
 *     --url http://127.0.0.1:3000/login \
 *     --email alvo@example.com \
 *     --attempts 12 --ips 2
 *
 * Saída: tabela por IP com a contagem de respostas e o ponto de bloqueio.
 */

interface Args {
  url: string;
  email: string;
  attempts: number;
  ips: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    const value = i >= 0 ? argv[i + 1] : undefined;
    return value ?? fallback;
  };
  return {
    url: get('--url', 'http://127.0.0.1:3000/login'),
    email: get('--email', 'alvo@example.com'),
    attempts: Number(get('--attempts', '12')),
    ips: Number(get('--ips', '1')),
  };
}

interface AttemptResult {
  ip: string;
  index: number;
  status: number;
  ms: number;
}

async function attemptLogin(url: string, email: string, ip: string, index: number): Promise<AttemptResult> {
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // IP sintético: em ambiente local o clientIp() lê x-forwarded-for.
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ email, senha: `senha-errada-${index}` }),
  }).catch(() => null);

  return {
    ip,
    index,
    status: res?.status ?? 0,
    ms: Math.round(performance.now() - t0),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log('▶ Ensaio D-001 — lockout por (email, ip)');
  console.log(`   alvo:     ${args.email}`);
  console.log(`   endpoint: ${args.url}`);
  console.log(`   ${args.attempts} tentativas × ${args.ips} IP(s) sintético(s)\n`);

  const ips = Array.from({ length: args.ips }, (_, i) => `203.0.113.${10 + i}`);

  const tasks: Promise<AttemptResult>[] = [];
  for (const ip of ips) {
    for (let i = 1; i <= args.attempts; i++) {
      tasks.push(attemptLogin(args.url, args.email, ip, i));
    }
  }

  const results = await Promise.all(tasks);

  for (const ip of ips) {
    const byIp = results.filter((r) => r.ip === ip).sort((a, b) => a.index - b.index);
    console.log(`IP ${ip}:`);
    for (const r of byIp) {
      console.log(`  tentativa ${String(r.index).padStart(2)} → HTTP ${r.status} (${r.ms}ms)`);
    }
    console.log(
      `  esperado: as ~${5} primeiras chegam ao provedor; a partir da 6ª, bloqueio transparente.\n`,
    );
  }

  console.log('✔ Registre a observação (bloqueio na 6ª tentativa) no PR — validação com sponsor.');
}

main().catch((err) => {
  console.error('Falha no ensaio:', err);
  process.exit(1);
});
