Paste everything below the line into the Replit Agent chat inside your **VacancyTrackerAi** app.

---

I want to add a batch of UK pension-sector employers to the careers directory so the automated scraper starts picking up their vacancies. Please do this:

1. Open `artifacts/api-server/src/config/data/careers-directory-seed.json`. Find the `"pensions"` industry block and its `"employers"` array (it already has entries like Aviva, Legal & General, XPS Pensions Group, etc.).

2. Merge in the employers from the JSON array below. Rules:
   - Do a case-insensitive match on `name` against the existing employers in the `pensions` block. If a name already exists, skip it (don't duplicate) — but if the existing entry is missing a `careersUrl`, `segment`, `locationIncludes`, or `notes` that the new entry has, feel free to fill in the gap.
   - Keep every other existing entry in the file exactly as-is.
   - `segment` must be one of `"provider"`, `"administrator"`, or `"consultancy"` — all entries below already use one of those three values, so just validate as you go.
   - Preserve valid JSON formatting (trailing commas, etc.).

3. About 40 of the entries below have a `"notes"` field containing `"verify URL"` — these are my best-effort guesses at the company's careers page and may be wrong or dead links. Please keep the `notes` field as-is (don't strip it) so it's easy to find them later, and if you're able to quickly check any of them (e.g. via a HEAD request or fetch) and a URL 404s, try to find the correct one instead. Don't block the whole import on this — better to add the row with a flagged URL than to skip it.

4. After merging, regenerate the derived TypeScript config:
   ```
   pnpm --filter @workspace/scripts run generate:careers-directory
   ```
   Confirm `artifacts/api-server/src/config/careersDirectorySeedEmployers.ts` regenerated without errors and there are no duplicate `name` entries in the pensions block.

5. Report back: how many new employers were added, how many were skipped as duplicates, and a short list of which ones still need URL verification.

Here's the batch to merge in (103 employers — provider, administrator, and consultancy segments). Note: about 11 of these (Aviva, Legal & General, Royal London, Phoenix Group, Aegon UK, Smart Pension, The People's Partnership, XPS Pensions Group, Barnett Waddingham, Hymans Robertson, LCP) are already in your pensions directory — that's expected, they'll just be skipped as duplicates per the rule above, so the real net-new count will be roughly 92:

```json
[
  {
    "name": "Aviva",
    "careersUrl": "https://careers.aviva.com",
    "segment": "provider"
  },
  {
    "name": "Legal & General",
    "careersUrl": "https://careers.legalandgeneral.com",
    "segment": "provider"
  },
  {
    "name": "Royal London",
    "careersUrl": "https://jobs.royallondon.com",
    "segment": "provider"
  },
  {
    "name": "Phoenix Group",
    "careersUrl": "https://www.thephoenixgroup.com/careers",
    "segment": "provider"
  },
  {
    "name": "Standard Life (Phoenix Group)",
    "careersUrl": "https://www.standardlife.co.uk/careers",
    "segment": "provider",
    "notes": "verify URL - brand sits under Phoenix Group"
  },
  {
    "name": "Aegon UK",
    "careersUrl": "https://www.aegon.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "Smart Pension",
    "careersUrl": "https://www.smartpension.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "The People's Partnership",
    "careersUrl": "https://peoplespartnership.co.uk/careers/",
    "segment": "provider"
  },
  {
    "name": "NEST Corporation",
    "careersUrl": "https://www.nestpensions.org.uk/schemeweb/nest/aboutnest/careers.html",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Scottish Widows",
    "careersUrl": "https://www.lloydsbankinggroupcareers.com",
    "segment": "provider",
    "notes": "part of Lloyds Banking Group"
  },
  {
    "name": "Prudential UK / M&G plc",
    "careersUrl": "https://careers.mandg.com",
    "segment": "provider"
  },
  {
    "name": "Fidelity International",
    "careersUrl": "https://careers.fidelityinternational.com",
    "segment": "provider",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "global firm - filter to UK roles"
  },
  {
    "name": "Zurich UK",
    "careersUrl": "https://www.zurich.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "Sanlam UK",
    "careersUrl": "https://www.sanlam.co.uk/about-us/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Quilter",
    "careersUrl": "https://careers.quilter.com",
    "segment": "provider"
  },
  {
    "name": "Now: Pensions",
    "careersUrl": "https://www.nowpensions.com/about-us/careers/",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Cushon",
    "careersUrl": "https://www.cushon.co.uk/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "TPT Retirement Solutions",
    "careersUrl": "https://www.tpt.org.uk/about-us/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "HSBC (HSBC Master Trust)",
    "careersUrl": "https://www.hsbc.com/careers",
    "segment": "provider",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "global firm - filter to UK roles"
  },
  {
    "name": "Atlas Master Trust (Lloyds Banking Group)",
    "careersUrl": "https://www.lloydsbankinggroupcareers.com",
    "segment": "provider"
  },
  {
    "name": "Ensign Retirement Plan",
    "careersUrl": "https://www.ensignpensions.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Salvus Master Trust",
    "careersUrl": "https://www.salvusmastertrust.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Creative Pension Trust",
    "careersUrl": "https://www.createpensiontrust.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "National Pension Trust",
    "careersUrl": "https://www.nationalpensiontrust.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Workers Pension Trust",
    "careersUrl": "https://www.workerspensiontrust.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "True Potential",
    "careersUrl": "https://www.tpllp.com/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Nutmeg (JPMorgan)",
    "careersUrl": "https://www.nutmeg.com/careers",
    "segment": "provider"
  },
  {
    "name": "PensionBee",
    "careersUrl": "https://www.pensionbee.com/careers",
    "segment": "provider"
  },
  {
    "name": "Penfold",
    "careersUrl": "https://getpenfold.com/careers",
    "segment": "provider"
  },
  {
    "name": "Moneyfarm",
    "careersUrl": "https://www.moneyfarm.com/uk/careers",
    "segment": "provider"
  },
  {
    "name": "Wealthify (Aviva)",
    "careersUrl": "https://www.wealthify.com/careers",
    "segment": "provider"
  },
  {
    "name": "AJ Bell",
    "careersUrl": "https://www.ajbell.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "Hargreaves Lansdown",
    "careersUrl": "https://careers.hl.co.uk",
    "segment": "provider"
  },
  {
    "name": "Interactive Investor",
    "careersUrl": "https://www.ii.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "Vanguard UK",
    "careersUrl": "https://about.vanguard.com/careers",
    "segment": "provider",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "global firm - filter to UK roles"
  },
  {
    "name": "Charles Stanley",
    "careersUrl": "https://www.charles-stanley.co.uk/careers",
    "segment": "provider"
  },
  {
    "name": "Bestinvest (Evelyn Partners)",
    "careersUrl": "https://www.evelyn.com/careers",
    "segment": "provider"
  },
  {
    "name": "Halifax Share Dealing (Lloyds)",
    "careersUrl": "https://www.lloydsbankinggroupcareers.com",
    "segment": "provider"
  },
  {
    "name": "Barclays Smart Investor",
    "careersUrl": "https://home.barclays/careers",
    "segment": "provider",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "Freetrade",
    "careersUrl": "https://freetrade.io/careers",
    "segment": "provider"
  },
  {
    "name": "Close Brothers Asset Management",
    "careersUrl": "https://www.closebrothersam.com/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "James Hay Partnership",
    "careersUrl": "https://www.jameshay.co.uk/about-us/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Curtis Banks Group",
    "careersUrl": "https://www.curtisbanks.co.uk/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Talbot and Muir",
    "careersUrl": "https://www.talbotmuir.co.uk/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Dentons Pension Management",
    "careersUrl": "https://www.dentonspensions.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Momentum Pensions",
    "careersUrl": "https://momentumpensions.com",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Embark Group",
    "careersUrl": "https://www.embarkgroup.co.uk/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Novia Financial",
    "careersUrl": "https://www.novafinancial.co.uk",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Mattioli Woods",
    "careersUrl": "https://www.mattioliwoods.com/careers",
    "segment": "provider",
    "notes": "verify URL"
  },
  {
    "name": "Equiniti (EQ)",
    "careersUrl": "https://equiniti.com/uk/careers",
    "segment": "administrator"
  },
  {
    "name": "Capita Pension Solutions",
    "careersUrl": "https://careers.capita.com",
    "segment": "administrator"
  },
  {
    "name": "Aptia Group",
    "careersUrl": "https://www.aptia-group.com/careers",
    "segment": "administrator",
    "notes": "formerly JLT/Mercer pensions admin - verify URL"
  },
  {
    "name": "Premier Pensions Management",
    "careersUrl": "https://www.premiercompanies.co.uk/careers",
    "segment": "administrator",
    "notes": "verify URL"
  },
  {
    "name": "RPMI (Railpen)",
    "careersUrl": "https://www.railpen.com/careers",
    "segment": "administrator"
  },
  {
    "name": "Trafalgar House",
    "careersUrl": "https://www.trafalgarhouse.co.uk/careers",
    "segment": "administrator",
    "notes": "verify URL"
  },
  {
    "name": "HS Admin",
    "careersUrl": "https://www.hsadmin.co.uk",
    "segment": "administrator",
    "notes": "verify URL - low confidence"
  },
  {
    "name": "ITM Limited",
    "careersUrl": "https://www.itmlimited.com/careers",
    "segment": "administrator",
    "notes": "verify URL"
  },
  {
    "name": "Zellis",
    "careersUrl": "https://www.zellis.com/careers",
    "segment": "administrator",
    "notes": "payroll & pensions admin services"
  },
  {
    "name": "Border to Coast Pensions Partnership",
    "careersUrl": "https://www.bordertocoast.org.uk/careers",
    "segment": "administrator",
    "notes": "LGPS pool"
  },
  {
    "name": "LGPS Central",
    "careersUrl": "https://www.lgpscentral.co.uk/careers",
    "segment": "administrator",
    "notes": "LGPS pool - verify URL"
  },
  {
    "name": "Local Pensions Partnership Investments",
    "careersUrl": "https://www.localpensionspartnership.org.uk/careers",
    "segment": "administrator",
    "notes": "LGPS pool - verify URL"
  },
  {
    "name": "London CIV",
    "careersUrl": "https://www.londonciv.org.uk/careers",
    "segment": "administrator",
    "notes": "LGPS pool - verify URL"
  },
  {
    "name": "Wales Pension Partnership",
    "careersUrl": "https://www.walespensionpartnership.org",
    "segment": "administrator",
    "notes": "LGPS pool - verify URL"
  },
  {
    "name": "Greater Manchester Pension Fund",
    "careersUrl": "https://www.gmpf.org.uk/careers",
    "segment": "administrator",
    "notes": "LGPS administering authority (Northern LGPS)"
  },
  {
    "name": "West Yorkshire Pension Fund",
    "careersUrl": "https://www.wypf.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Strathclyde Pension Fund",
    "careersUrl": "https://www.spfo.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "West Midlands Pension Fund",
    "careersUrl": "https://www.wmpfonline.com",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Environment Agency Pension Fund",
    "careersUrl": "https://www.eapf.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Merseyside Pension Fund",
    "careersUrl": "https://www.merseysidepensionfund.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "South Yorkshire Pensions Authority",
    "careersUrl": "https://www.sypensions.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Teesside Pension Fund",
    "careersUrl": "https://www.teespen.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Tyne and Wear Pension Fund",
    "careersUrl": "https://www.twpf.info",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Cheshire Pension Fund",
    "careersUrl": "https://www.cheshirepensionfund.org",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Lancashire County Pension Fund",
    "careersUrl": "https://www.lancashirecountypensionfund.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Nottinghamshire Pension Fund",
    "careersUrl": "https://www.nottspf.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Hampshire Pension Fund",
    "careersUrl": "https://www.hants.gov.uk/hampshire-pension-fund",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Kent Pension Fund",
    "careersUrl": "https://www.kentpensionfund.co.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Essex Pension Fund",
    "careersUrl": "https://www.essexpensionfund.co.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Surrey Pension Fund",
    "careersUrl": "https://www.surreypensionfund.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Devon Pension Fund",
    "careersUrl": "https://www.devonpensionfund.org.uk",
    "segment": "administrator",
    "notes": "LGPS administering authority - verify URL"
  },
  {
    "name": "Mercer",
    "careersUrl": "https://careers.mercer.com",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "also runs Mercer Master Trust"
  },
  {
    "name": "Willis Towers Watson (WTW)",
    "careersUrl": "https://careers.wtwco.com",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "also runs LifeSight Master Trust"
  },
  {
    "name": "Aon",
    "careersUrl": "https://aon.wd1.myworkdayjobs.com/aoncareers",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"],
    "notes": "also runs Aon Master Trust - verify URL"
  },
  {
    "name": "LCP",
    "careersUrl": "https://www.lcp.com/en/careers",
    "segment": "consultancy"
  },
  {
    "name": "Barnett Waddingham",
    "careersUrl": "https://www.barnett-waddingham.co.uk/careers/",
    "segment": "consultancy"
  },
  {
    "name": "Hymans Robertson",
    "careersUrl": "https://careers.hymans.co.uk",
    "segment": "consultancy"
  },
  {
    "name": "XPS Pensions Group",
    "careersUrl": "https://careers.xpsgroup.com",
    "segment": "consultancy"
  },
  {
    "name": "Isio",
    "careersUrl": "https://www.isio.com/careers",
    "segment": "consultancy"
  },
  {
    "name": "Broadstone",
    "careersUrl": "https://broadstone.co.uk/careers",
    "segment": "consultancy"
  },
  {
    "name": "Quantum Advisory",
    "careersUrl": "https://www.quantumadvisory.co.uk/careers",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "First Actuarial",
    "careersUrl": "https://www.firstactuarial.co.uk/careers",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "Spence & Partners",
    "careersUrl": "https://www.spenceandpartners.co.uk/careers",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "Redington",
    "careersUrl": "https://www.redington.co.uk/careers",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "Punter Southall",
    "careersUrl": "https://www.puntersouthall.com",
    "segment": "consultancy",
    "notes": "brand history now largely under Xafinity/Aptia - verify URL"
  },
  {
    "name": "Buck (Gallagher)",
    "careersUrl": "https://www.gallagherbenefits.co.uk/careers",
    "segment": "consultancy"
  },
  {
    "name": "Arthur J. Gallagher",
    "careersUrl": "https://www.ajg.com/uk/careers",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "KPMG UK (Pensions Advisory)",
    "careersUrl": "https://www.kpmgcareers.co.uk",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "PwC UK (Pensions)",
    "careersUrl": "https://www.pwc.co.uk/careers",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "Deloitte UK (Pensions)",
    "careersUrl": "https://www.deloitte.co.uk/careers",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "EY UK (Pensions)",
    "careersUrl": "https://www.ey.com/en_uk/careers",
    "segment": "consultancy",
    "locationIncludes": ["united kingdom", "uk"]
  },
  {
    "name": "Cartwright Group",
    "careersUrl": "https://cartwright-uk.com/careers",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "Hughes Price Walker",
    "careersUrl": "https://www.hpw.co.uk",
    "segment": "consultancy",
    "notes": "verify URL"
  },
  {
    "name": "Goddard Perry Actuarial",
    "careersUrl": "https://www.goddardperry.co.uk",
    "segment": "consultancy",
    "notes": "verify URL"
  }
]
```

---

**Note on job roles/functions:** your app has no separate "roles" table — job titles live as free text on the `jobs` table once vacancies are scraped, so there's nothing to bulk-import there directly. I've included a separate `pension_industry_job_roles.csv` with ~50 common pensions job titles mapped to function categories (actuarial, administration, consulting, investment, etc.) and a ready-made search query for each. If you want richer vacancy coverage beyond what the careers-page scraper finds, you can optionally ask Replit Agent to loop through those role queries against your existing ingestion endpoints, e.g.:

```
POST /api/internal/ingestion/reed
{ "query": "pensions administrator", "location": "United Kingdom" }

POST /api/internal/ingestion/adzuna
{ "query": "scheme actuary", "location": "United Kingdom" }

POST /api/internal/ingestion/google-jobs
{ "query": "pensions consultant", "company": "Mercer", "location": "United Kingdom" }
```

These require an authenticated admin session (cookie from `POST /api/auth/login`). This is optional — the careers-directory addition above is the main event and will start picking up live vacancies from the new employers on the next hourly sweep.
