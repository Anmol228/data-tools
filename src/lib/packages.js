// Public packages behind each tool's monthly download numbers (from the researched data).
// The daily refresh job fetches these; tools not listed here have no public monthly numbers.
// ETL / ELT uses Google search interest, which has no free official API, so it is not refreshed automatically.
export const PACKAGES = {
  orch: {
    source: "pypi",
    tools: {
      "Temporal": "temporalio", "Apache Airflow": "apache-airflow", "Prefect": "prefect", "Dagster": "dagster",
      "Kubeflow Pipelines": "kfp", "Kestra": "kestra", "Luigi": "luigi", "Windmill": "wmill", "Metaflow": "metaflow",
      "Flyte": "flytekit", "ZenML": "zenml", "Mage": "mage-ai", "Apache DolphinScheduler": "apache-dolphinscheduler"
    }
  },
  bi: {
    source: "npm",
    tools: {
      "Microsoft Power BI": "powerbi-client", "Apache Superset": "@superset-ui/embedded-sdk",
      "Amazon QuickSight": "amazon-quicksight-embedding-sdk", "ThoughtSpot": "@thoughtspot/visual-embed-sdk",
      "Omni": "@omni-co/embed", "Looker": "@looker/embed-sdk", "Metabase": "@metabase/embedding-sdk-react",
      "Tableau": "@tableau/embedding-api", "Sigma Computing": "@sigmacomputing/embed-sdk", "Lightdash": "@lightdash/sdk",
      "GoodData": "@gooddata/sdk-ui", "Preset": "@preset-sdk/embedded", "Sisense": "@sisense/sdk-ui", "Qlik Sense": "@qlik/embed-react"
    }
  },
  transform: { source: "pypi", tools: { "dbt": "dbt-core", "SQLMesh": "sqlmesh" } },
  store: {
    source: "pypi",
    tools: {
      "DuckDB": "duckdb", "Apache Iceberg": "pyiceberg", "Delta Lake": "delta-spark", "Apache Hudi": "hudi",
      "ClickHouse": "clickhouse-connect", "Trino": "trino"
    }
  },
  dq: {
    source: "pypi",
    tools: {
      "Great Expectations": "great-expectations", "Soda": "soda-core", "Elementary": "elementary-data",
      "Monte Carlo": "pycarlo", "Anomalo": "anomalo"
    }
  },
  catalog: { source: "pypi", tools: { "DataHub": "acryl-datahub", "OpenMetadata": "openmetadata-ingestion" } }
};
