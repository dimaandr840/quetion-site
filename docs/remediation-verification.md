# Remediation verification

Commit: `a70fa0b85794ab9bf1f06bc16c2f3d7bf9fc9138`

UTC: 2026-09-07T10:51:03.631295+00:00

Automated checks only. This does not certify staging, PostgreSQL concurrency, mobile UX or production recovery.

## Backend verify

Exit: **0**

Command: `mvn -B -ntp verify`


````text

anager configured with UserDetailsService bean with name appUserDetailsService
10:51:24.442 INFO  [] c.d.api.ReliabilityRegressionTest - Started ReliabilityRegressionTest in 1.55 seconds (process running for 11.752)
10:51:24.444 INFO  [] com.devprep.api.seed.AdminBootstrap - ADMIN_EMAIL/ADMIN_PASSWORD не заданы — администратор не создан
10:51:24.599 INFO  [] com.devprep.api.seed.SeedImporter - Импортировано: сфер=8, профессий=33, специализаций=20, тем=31, вопросов=28
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.038 s -- in com.devprep.api.ReliabilityRegressionTest
[INFO] Running com.devprep.api.AfterCommitTest
10:51:30.926 INFO  [] o.s.t.c.s.AnnotationConfigContextLoaderUtils - Could not detect default configuration classes for test class [com.devprep.api.AfterCommitTest]: AfterCommitTest does not declare any static, non-private, non-final, nested classes annotated with @Configuration.
10:51:30.927 INFO  [] o.s.b.t.c.SpringBootTestContextBootstrapper - Found @SpringBootConfiguration com.devprep.api.DevPrepApiApplication for test class com.devprep.api.AfterCommitTest
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.017 s -- in com.devprep.api.AfterCommitTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 16, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] 
[INFO] --- jar:3.4.2:jar (default-jar) @ devprep-api ---
[INFO] Building jar: /home/runner/work/quetion-site/quetion-site/backend/target/devprep-api.jar
[INFO] 
[INFO] --- spring-boot:3.5.16:repackage (repackage) @ devprep-api ---
[INFO] Replacing main artifact /home/runner/work/quetion-site/quetion-site/backend/target/devprep-api.jar with repackaged archive, adding nested dependencies in BOOT-INF/.
[INFO] The original artifact has been renamed to /home/runner/work/quetion-site/quetion-site/backend/target/devprep-api.jar.original
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  25.874 s
[INFO] Finished at: 2026-09-07T10:51:31Z
[INFO] ------------------------------------------------------------------------

````

## Frontend clean install

Exit: **0**

Command: `npm ci --no-audit --no-fund`


````text

npm warn deprecated prom-client@15.1.3: prom-client has been replaced by @prometheus-io/client

added 367 packages in 12s
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.

````

## Frontend lint

Exit: **1**

Command: `npm run lint`


````text


> qareer-quest@1.0.0 lint
> eslint .


/home/runner/work/quetion-site/quetion-site/frontend/components/ui/filters/useFilterDialog.ts
  29:52  error  Error: This value cannot be modified

Modifying component props or hook arguments is not allowed. Consider using a local variable instead.

/home/runner/work/quetion-site/quetion-site/frontend/components/ui/filters/useFilterDialog.ts:29:52
  27 |       for (const sibling of parent.children) {
  28 |         if (sibling !== branch && sibling instanceof HTMLElement) {
> 29 |           restored.push([sibling, sibling.inert]); sibling.inert = true;
     |                                                    ^^^^^^^ `panelRef` cannot be modified
  30 |         }
  31 |       }
  32 |       branch = parent;  react-hooks/immutability

✖ 1 problem (1 error, 0 warnings)


````

## Frontend typecheck

Exit: **0**

Command: `npm run typecheck`


````text


> qareer-quest@1.0.0 typecheck
> tsc --noEmit


````

## Frontend regression tests

Exit: **0**

Command: `npm test`


````text


> qareer-quest@1.0.0 test
> node --experimental-strip-types --test scripts/*.test.mjs

(node:2558) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/quetion-site/quetion-site/frontend/lib/progress.ts?test=denied is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/quetion-site/quetion-site/frontend/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ denied storage preserves set, change and removal in memory (40.730686ms)
✔ quota errors do not revert new values to old disk content (2.086721ms)
✔ storage events synchronize other tabs and clean up subscriptions (3.796795ms)
✔ invalid storage is ignored and server snapshot stays neutral (5.313314ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 126.773061

````

## Design tokens

Exit: **0**

Command: `npm run check:tokens`


````text

-quest@1.0.0 check:tokens
> node scripts/check-tokens.mjs

check-tokens: baseline зафиксирован — 138 обращений к легаси-токенам.
Закоммитьте scripts/token-debt.json: дальше число может только уменьшаться.
  app/(public)/legal/legal.module.css:21  --radius-6 → --radius-inset
  app/(public)/page.module.css:198  --font-outfit → --font-display
  app/(public)/professions/[slug]/page.module.css:34  --font-jetbrains-mono → --font-mono
  app/(public)/professions/[slug]/page.module.css:75  --font-jetbrains-mono → --font-mono
  app/(public)/professions/page.module.css:31  --radius-12 → --radius-surface
  app/(public)/professions/page.module.css:54  --font-jetbrains-mono → --font-mono
  app/(public)/questions/[slug]/question.module.css:56  --radius-12 → --radius-surface
  app/(public)/questions/[slug]/question.module.css:60  --font-jetbrains-mono → --font-mono
  app/(public)/questions/[slug]/question.module.css:108  --radius-4 → --radius-inset
  app/(public)/questions/[slug]/question.module.css:118  --radius-4 → --radius-inset
  app/(public)/questions/[slug]/question.module.css:121  --font-jetbrains-mono → --font-mono
  app/(public)/questions/[slug]/question.module.css:133  --radius-4 → --radius-inset
  app/(public)/questions/[slug]/question.module.css:167  --radius-12 → --radius-surface
  app/(public)/questions/[slug]/question.module.css:173  --font-outfit → --font-display
  app/(public)/questions/[slug]/question.module.css:216  --font-outfit → --font-display
  app/(public)/questions/[slug]/question.module.css:263  --radius-12 → --radius-surface
  app/admin/login/page.module.css:14  --radius-16 → --radius-surface
  app/admin/login/page.module.css:29  --radius-8 → --radius-control
  app/admin/login/page.module.css:34  --font-outfit → --font-display
  app/admin/login/page.module.css:40  --font-outfit → --font-display
  app/admin/login/page.module.css:80  --radius-8 → --radius-control
  app/admin/login/page.module.css:94  --font-jetbrains-mono → --font-mono
  app/admin/login/page.module.css:103  --radius-8 → --radius-control
  app/admin/login/page.module.css:124  --radius-8 → --radius-control
  app/admin/login/page.module.css:132  --radius-8 → --radius-control
  … и ещё 113

````

## Frontend build

Exit: **0**

Command: `npm run build`


````text

NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
  Generating static pages using 3 workers (0/4) ...
[seo] NEXT_PUBLIC_SITE_URL не задан — canonical, Open Graph и sitemap.xml будут указывать на https://qareerquest.com
  Generating static pages using 3 workers (1/4) 
  Generating static pages using 3 workers (2/4) 
  Generating static pages using 3 workers (3/4) 
✓ Generating static pages using 3 workers (4/4) in 176ms
Turbopack build encountered 1 warning:
./instrumentation.ts:27:5
Warning: A Node.js module is loaded ('node:http' at line 27) which is not supported in the Edge Runtime.
    Learn More: https://nextjs.org/docs/messages/node-module-in-edge-runtime
  [90m25 |[0m
  [90m26 |[0m   [36mconst[0m [{ createServer }, promClient] = [36mawait[0m [33mPromise[0m.all([
[33m[1m>[0m [90m27 |[0m     [36mimport[0m([32m"node:http"[0m),
  [90m   |[0m     [33m[1m^^^^^^^^^^^^^^^^^^^[0m
  [90m28 |[0m     [36mimport[0m([32m"prom-client"[0m),
  [90m29 |[0m   ]);
  [90m30 |[0m

Ecmascript file had an error


  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /admin
├ ƒ /admin/categories
├ ƒ /admin/login
├ ƒ /admin/login/reset
├ ƒ /admin/professions
├ ƒ /admin/questions
├ ƒ /admin/stats
├ ƒ /admin/users
├ ƒ /categories
├ ○ /icon.svg
├ ƒ /legal/cookies
├ ƒ /legal/privacy
├ ƒ /professions
├ ƒ /professions/[slug]
├ ƒ /professions/[slug]/[category]
├ ƒ /questions
├ ● /questions/[slug]
├ ○ /robots.txt
├ ƒ /search
└ ƒ /sitemap.xml


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand


````

## Release shell syntax

Exit: **0**

Command: `bash -n scripts/deploy-release.sh`


````text


````
