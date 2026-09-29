-- =====================================================================
-- Supply Chain 360 Native App — SELF-CONTAINED setup script
-- Data is bundled in the package (SHARED_DATA). No consumer references.
-- =====================================================================

CREATE APPLICATION ROLE IF NOT EXISTS app_public;

-- ---------------------------------------------------------------------
-- config schema: settings consumed by the container (e.g. semantic view)
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS config;
GRANT USAGE ON SCHEMA config TO APPLICATION ROLE app_public;
CREATE TABLE IF NOT EXISTS config.settings(key STRING, value STRING);

-- ---------------------------------------------------------------------
-- app_data schema: views over the bundled data + Cortex Analyst semantic view
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_data;
GRANT USAGE ON SCHEMA app_data TO APPLICATION ROLE app_public;

CREATE OR REPLACE VIEW app_data.DT_MANUFACTURING_KPI AS SELECT * FROM shared_data.DT_MANUFACTURING_KPI;
GRANT SELECT ON VIEW app_data.DT_MANUFACTURING_KPI TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_PRODUCTION_ORDER_360 AS SELECT * FROM shared_data.DT_PRODUCTION_ORDER_360;
GRANT SELECT ON VIEW app_data.DT_PRODUCTION_ORDER_360 TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_BOM_EXPLOSION AS SELECT * FROM shared_data.DT_BOM_EXPLOSION;
GRANT SELECT ON VIEW app_data.DT_BOM_EXPLOSION TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_INVENTORY_OVERVIEW AS SELECT * FROM shared_data.DT_INVENTORY_OVERVIEW;
GRANT SELECT ON VIEW app_data.DT_INVENTORY_OVERVIEW TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_DELIVERY_PERFORMANCE AS SELECT * FROM shared_data.DT_DELIVERY_PERFORMANCE;
GRANT SELECT ON VIEW app_data.DT_DELIVERY_PERFORMANCE TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_WORK_CENTER_UTILIZATION AS SELECT * FROM shared_data.DT_WORK_CENTER_UTILIZATION;
GRANT SELECT ON VIEW app_data.DT_WORK_CENTER_UTILIZATION TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_PROJECT_STATUS AS SELECT * FROM shared_data.DT_PROJECT_STATUS;
GRANT SELECT ON VIEW app_data.DT_PROJECT_STATUS TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_SUPPLY_CHAIN_GEO AS SELECT * FROM shared_data.DT_SUPPLY_CHAIN_GEO;
GRANT SELECT ON VIEW app_data.DT_SUPPLY_CHAIN_GEO TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_SUPPLIER_QUALITY AS SELECT * FROM shared_data.DT_SUPPLIER_QUALITY;
GRANT SELECT ON VIEW app_data.DT_SUPPLIER_QUALITY TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.A_SUPPLY_CHAIN_NODES AS SELECT * FROM shared_data.A_SUPPLY_CHAIN_NODES;
GRANT SELECT ON VIEW app_data.A_SUPPLY_CHAIN_NODES TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.A_PLANT AS SELECT * FROM shared_data.A_PLANT;
GRANT SELECT ON VIEW app_data.A_PLANT TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.LINEAGE_COUNTS AS SELECT * FROM shared_data.LINEAGE_COUNTS;
GRANT SELECT ON VIEW app_data.LINEAGE_COUNTS TO APPLICATION ROLE app_public;

-- Semantic view for Cortex Analyst, built over the bundled APP_DATA views.
create or replace semantic view APP_DATA.SAP_SUPPLY_CHAIN_360
	tables (
		MANUFACTURING_KPI as APP_DATA.DT_MANUFACTURING_KPI comment='Monthly manufacturing performance metrics by plant including OEE, throughput, scrap rate, on-time delivery, and inventory turnover.',
		PRODUCTION_ORDER as APP_DATA.DT_PRODUCTION_ORDER_360 primary key (PRODUCTION_ORDER) comment='Production orders with planning, confirmation, yield, and scrap data. Includes cycle time and order status tracking across plants and work centers.',
		BOM_EXPLOSION as APP_DATA.DT_BOM_EXPLOSION comment='Multi-level bill of materials showing parent-component relationships, quantities, units of measure, and costs for all manufactured products.',
		WORK_CENTER_UTILIZATION as APP_DATA.DT_WORK_CENTER_UTILIZATION comment='Monthly work center capacity and utilization data. Tracks available vs used hours to identify production bottlenecks across plants.',
		INVENTORY_OVERVIEW as APP_DATA.DT_INVENTORY_OVERVIEW primary key (MATERIAL) unique (MATERIAL,PLANT) comment='Current stock positions by material, plant, and storage location. Includes days of inventory, turnover rates, and obsolescence flags.',
		DELIVERY_PERFORMANCE as APP_DATA.DT_DELIVERY_PERFORMANCE primary key (DELIVERY_ID) comment='Outbound delivery tracking with on-time performance, delay analysis, and shipping point metrics for logistics monitoring.',
		SUPPLIER_QUALITY as APP_DATA.DT_SUPPLIER_QUALITY comment='Quarterly supplier performance scoring including defect rates, on-time delivery percentages, and composite quality scores per material.',
		PROJECT_STATUS as APP_DATA.DT_PROJECT_STATUS comment='Capital and operational project tracking with budget variance, completion percentage, and WBS element breakdown.',
		SUPPLY_CHAIN_GEO as APP_DATA.DT_SUPPLY_CHAIN_GEO comment='Geographic supply chain flow data showing material movements between suppliers, plants, and distribution centers with coordinates for map visualization.'
	)
	relationships (
		DT_PRODUCTION_ORDER_360_TO_DT_INVENTORY_OVERVIEW as PRODUCTION_ORDER(MATERIAL,PLANT) references INVENTORY_OVERVIEW(MATERIAL,PLANT),
		DT_DELIVERY_PERFORMANCE_TO_DT_INVENTORY_OVERVIEW as DELIVERY_PERFORMANCE(MATERIAL) references INVENTORY_OVERVIEW(MATERIAL),
		DT_SUPPLIER_QUALITY_TO_DT_INVENTORY_OVERVIEW as SUPPLIER_QUALITY(MATERIAL) references INVENTORY_OVERVIEW(MATERIAL)
	)
	facts (
		MANUFACTURING_KPI.OEE_PCT as OEE_PCT comment='Overall Equipment Effectiveness percentage.',
		MANUFACTURING_KPI.CYCLE_TIME_AVG as CYCLE_TIME_AVG comment='Average manufacturing cycle time in days.',
		MANUFACTURING_KPI.SCRAP_RATE_PCT as SCRAP_RATE_PCT comment='Percentage of production scrapped.',
		MANUFACTURING_KPI.ON_TIME_DELIVERY_PCT as ON_TIME_DELIVERY_PCT comment='Percentage of orders delivered on time.',
		MANUFACTURING_KPI.INVENTORY_TURNOVER as INVENTORY_TURNOVER comment='Inventory turns per period.',
		PRODUCTION_ORDER.PLANNED_QTY as PLANNED_QTY comment='Planned production quantity.',
		PRODUCTION_ORDER.CONFIRMED_QTY as CONFIRMED_QTY comment='Confirmed completed quantity.',
		PRODUCTION_ORDER.SCRAP_QTY as SCRAP_QTY comment='Scrapped quantity.',
		PRODUCTION_ORDER.YIELD_QTY as YIELD_QTY comment='Good output quantity.',
		PRODUCTION_ORDER.CYCLE_TIME_DAYS as CYCLE_TIME_DAYS comment='Actual cycle time in days.',
		BOM_EXPLOSION.COMPONENT_QTY as COMPONENT_QTY comment='Component quantity per parent.',
		BOM_EXPLOSION.BASE_QTY as BASE_QTY comment='Parent base quantity.',
		BOM_EXPLOSION.COMPONENT_COST as COMPONENT_COST comment='Component standard cost USD.',
		WORK_CENTER_UTILIZATION.AVAILABLE_CAPACITY_HRS as AVAILABLE_CAPACITY_HRS comment='Available capacity hours.',
		WORK_CENTER_UTILIZATION.USED_CAPACITY_HRS as USED_CAPACITY_HRS comment='Used capacity hours.',
		WORK_CENTER_UTILIZATION.UTILIZATION_PCT as UTILIZATION_PCT comment='Utilization percentage.',
		INVENTORY_OVERVIEW.STOCK_QTY as STOCK_QTY comment='Current stock quantity.',
		INVENTORY_OVERVIEW.STOCK_VALUE as STOCK_VALUE comment='Current stock value USD.',
		INVENTORY_OVERVIEW.TURNOVER_RATE as TURNOVER_RATE comment='Annual inventory turnover rate.',
		DELIVERY_PERFORMANCE.DELIVERY_QTY as DELIVERY_QTY comment='Delivered quantity.',
		SUPPLIER_QUALITY.DEFECT_RATE_PCT as DEFECT_RATE_PCT comment='Defect rate percentage.',
		SUPPLIER_QUALITY.ON_TIME_DELIVERY_PCT as ON_TIME_DELIVERY_PCT comment='Supplier on-time delivery percentage.',
		SUPPLIER_QUALITY.QUALITY_SCORE as QUALITY_SCORE comment='Composite quality score 0-100.',
		PROJECT_STATUS.PLANNED_COST as PLANNED_COST comment='Planned budget USD.',
		PROJECT_STATUS.ACTUAL_COST as ACTUAL_COST comment='Actual cost to date USD.',
		PROJECT_STATUS.BUDGET_VARIANCE_PCT as BUDGET_VARIANCE_PCT comment='Budget variance percentage.',
		PROJECT_STATUS.COMPLETION_PCT as COMPLETION_PCT comment='Project completion percentage.',
		SUPPLY_CHAIN_GEO.MONTHLY_VALUE as MONTHLY_VALUE comment='Monthly flow value USD.',
		SUPPLY_CHAIN_GEO.SOURCE_LAT as SOURCE_LAT comment='Source latitude.',
		SUPPLY_CHAIN_GEO.SOURCE_LON as SOURCE_LON comment='Source longitude.',
		SUPPLY_CHAIN_GEO.TARGET_LAT as TARGET_LAT comment='Target latitude.',
		SUPPLY_CHAIN_GEO.TARGET_LON as TARGET_LON comment='Target longitude.'
	)
	dimensions (
		MANUFACTURING_KPI.PLANT as PLANT comment='SAP plant code.',
		MANUFACTURING_KPI.PLANT_NAME as PLANT_NAME comment='Full plant name.',
		MANUFACTURING_KPI.THROUGHPUT as THROUGHPUT comment='Units produced in period.',
		MANUFACTURING_KPI.PERIOD_DATE as PERIOD_DATE comment='Monthly reporting period.',
		PRODUCTION_ORDER.PRODUCTION_ORDER as PRODUCTION_ORDER comment='Production order number.',
		PRODUCTION_ORDER.ORDER_TYPE as ORDER_TYPE comment='SAP order type.',
		PRODUCTION_ORDER.PLANT as PLANT comment='Plant code.',
		PRODUCTION_ORDER.PLANT_NAME as PLANT_NAME comment='Plant name.',
		PRODUCTION_ORDER.MATERIAL as MATERIAL comment='Material number.',
		PRODUCTION_ORDER.MATERIAL_DESC as MATERIAL_DESC comment='Material description.',
		PRODUCTION_ORDER.WORK_CENTER as WORK_CENTER comment='Work center code.',
		PRODUCTION_ORDER.ORDER_STATUS as ORDER_STATUS comment='Order status.',
		PRODUCTION_ORDER.CREATED_DATE as CREATED_DATE comment='Created date.',
		PRODUCTION_ORDER.BASIC_START_DATE as BASIC_START_DATE comment='Basic start date.',
		PRODUCTION_ORDER.BASIC_FINISH_DATE as BASIC_FINISH_DATE comment='Basic finish date.',
		BOM_EXPLOSION.PARENT_MATERIAL as PARENT_MATERIAL comment='Parent material.',
		BOM_EXPLOSION.PARENT_DESC as PARENT_DESC comment='Parent description.',
		BOM_EXPLOSION.BOM_NUMBER as BOM_NUMBER comment='BOM number.',
		BOM_EXPLOSION.BOM_LEVEL as BOM_LEVEL comment='BOM level.',
		BOM_EXPLOSION.COMPONENT_MATERIAL as COMPONENT_MATERIAL comment='Component material.',
		BOM_EXPLOSION.COMPONENT_DESC as COMPONENT_DESC comment='Component description.',
		BOM_EXPLOSION.COMPONENT_UOM as COMPONENT_UOM comment='Component UOM.',
		BOM_EXPLOSION.ITEM_CATEGORY as ITEM_CATEGORY comment='Item category.',
		WORK_CENTER_UTILIZATION.WORK_CENTER as WORK_CENTER comment='Work center code.',
		WORK_CENTER_UTILIZATION.WORK_CENTER_DESC as WORK_CENTER_DESC comment='Work center description.',
		WORK_CENTER_UTILIZATION.PLANT as PLANT comment='Plant code.',
		WORK_CENTER_UTILIZATION.PLANT_NAME as PLANT_NAME comment='Plant name.',
		WORK_CENTER_UTILIZATION.PERIOD_DATE as PERIOD_DATE comment='Reporting period.',
		INVENTORY_OVERVIEW.MATERIAL as MATERIAL comment='Material number.',
		INVENTORY_OVERVIEW.MATERIAL_DESC as MATERIAL_DESC comment='Material description.',
		INVENTORY_OVERVIEW.PLANT as PLANT comment='Plant code.',
		INVENTORY_OVERVIEW.PLANT_NAME as PLANT_NAME comment='Plant name.',
		INVENTORY_OVERVIEW.STORAGE_LOCATION as STORAGE_LOCATION comment='Storage location.',
		INVENTORY_OVERVIEW.DAYS_OF_INVENTORY as DAYS_OF_INVENTORY comment='Days of inventory.',
		INVENTORY_OVERVIEW.OBSOLETE_FLAG as OBSOLETE_FLAG comment='Obsolete flag.',
		INVENTORY_OVERVIEW.LAST_MOVEMENT_DATE as LAST_MOVEMENT_DATE comment='Last movement date.',
		DELIVERY_PERFORMANCE.DELIVERY_ID as DELIVERY_ID comment='Delivery document number.',
		DELIVERY_PERFORMANCE.SHIPPING_POINT as SHIPPING_POINT comment='Shipping point code.',
		DELIVERY_PERFORMANCE.SHIPPING_POINT_DESC as SHIPPING_POINT_DESC comment='Shipping point description.',
		DELIVERY_PERFORMANCE.MATERIAL as MATERIAL comment='Material number.',
		DELIVERY_PERFORMANCE.MATERIAL_DESC as MATERIAL_DESC comment='Material description.',
		DELIVERY_PERFORMANCE.ON_TIME_FLAG as ON_TIME_FLAG comment='On-time flag.',
		DELIVERY_PERFORMANCE.DELAY_DAYS as DELAY_DAYS comment='Delay days.',
		DELIVERY_PERFORMANCE.PLANNED_DELIVERY_DATE as PLANNED_DELIVERY_DATE comment='Planned delivery date.',
		DELIVERY_PERFORMANCE.ACTUAL_DELIVERY_DATE as ACTUAL_DELIVERY_DATE comment='Actual delivery date.',
		DELIVERY_PERFORMANCE.DELIVERY_MONTH as DELIVERY_MONTH comment='Delivery month.',
		SUPPLIER_QUALITY.SUPPLIER as SUPPLIER comment='Supplier account number.',
		SUPPLIER_QUALITY.SUPPLIER_NAME as SUPPLIER_NAME comment='Supplier name.',
		SUPPLIER_QUALITY.MATERIAL as MATERIAL comment='Material number.',
		SUPPLIER_QUALITY.MATERIAL_DESC as MATERIAL_DESC comment='Material description.',
		SUPPLIER_QUALITY.TOTAL_DELIVERED as TOTAL_DELIVERED comment='Total delivered units.',
		SUPPLIER_QUALITY.DEFECT_QTY as DEFECT_QTY comment='Defective units.',
		SUPPLIER_QUALITY.PERIOD_DATE as PERIOD_DATE comment='Quarterly period.',
		PROJECT_STATUS.PROJECT_ID as PROJECT_ID comment='Project id.',
		PROJECT_STATUS.PROJECT_NAME as PROJECT_NAME comment='Project name.',
		PROJECT_STATUS.PLANT as PLANT comment='Plant code.',
		PROJECT_STATUS.PROJECT_STATUS as PROJECT_STATUS comment='Project status.',
		PROJECT_STATUS.WBS_ELEMENT as WBS_ELEMENT comment='WBS element.',
		PROJECT_STATUS.WBS_DESCRIPTION as WBS_DESCRIPTION comment='WBS description.',
		PROJECT_STATUS.START_DATE as START_DATE comment='Start date.',
		PROJECT_STATUS.END_DATE as END_DATE comment='End date.',
		SUPPLY_CHAIN_GEO.FLOW_ID as FLOW_ID comment='Flow id.',
		SUPPLY_CHAIN_GEO.FLOW_TYPE as FLOW_TYPE comment='Flow type.',
		SUPPLY_CHAIN_GEO.MATERIAL_CATEGORY as MATERIAL_CATEGORY comment='Material category.',
		SUPPLY_CHAIN_GEO.MONTHLY_VOLUME as MONTHLY_VOLUME comment='Monthly volume.',
		SUPPLY_CHAIN_GEO.SOURCE_NAME as SOURCE_NAME comment='Source name.',
		SUPPLY_CHAIN_GEO.SOURCE_TYPE as SOURCE_TYPE comment='Source type.',
		SUPPLY_CHAIN_GEO.SOURCE_CITY as SOURCE_CITY comment='Source city.',
		SUPPLY_CHAIN_GEO.SOURCE_COUNTRY as SOURCE_COUNTRY comment='Source country.',
		SUPPLY_CHAIN_GEO.SOURCE_PLANT as SOURCE_PLANT comment='Source plant code.',
		SUPPLY_CHAIN_GEO.TARGET_NAME as TARGET_NAME comment='Target name.',
		SUPPLY_CHAIN_GEO.TARGET_TYPE as TARGET_TYPE comment='Target type.',
		SUPPLY_CHAIN_GEO.TARGET_CITY as TARGET_CITY comment='Target city.',
		SUPPLY_CHAIN_GEO.TARGET_COUNTRY as TARGET_COUNTRY comment='Target country.',
		SUPPLY_CHAIN_GEO.TARGET_PLANT as TARGET_PLANT comment='Target plant code.'
	)
	comment='Unified semantic model for SAP Supply Chain analytics (bundled with the Native App).';
GRANT SELECT ON SEMANTIC VIEW app_data.SAP_SUPPLY_CHAIN_360 TO APPLICATION ROLE app_public;

-- Record the semantic view FQN for the container's Analyst page.
DELETE FROM config.settings WHERE key = 'semantic_view';
INSERT INTO config.settings(key, value)
  SELECT 'semantic_view', CURRENT_DATABASE() || '.APP_DATA.SAP_SUPPLY_CHAIN_360';

-- ---------------------------------------------------------------------
-- services schema (non-versioned): holds the SPCS service
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS services;
GRANT USAGE ON SCHEMA services TO APPLICATION ROLE app_public;

-- ---------------------------------------------------------------------
-- core schema (versioned): lifecycle + service management
-- ---------------------------------------------------------------------
CREATE OR ALTER VERSIONED SCHEMA core;
GRANT USAGE ON SCHEMA core TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.version_init()
  RETURNS STRING
  LANGUAGE SQL
  EXECUTE AS OWNER
AS $$
DECLARE
  pool_name VARCHAR;
  wh_name VARCHAR;
  svc_count INTEGER;
BEGIN
  pool_name := (SELECT CURRENT_DATABASE()) || '_POOL';
  wh_name   := (SELECT CURRENT_DATABASE()) || '_WH';

  CREATE COMPUTE POOL IF NOT EXISTS IDENTIFIER(:pool_name)
    MIN_NODES = 1 MAX_NODES = 1 INSTANCE_FAMILY = CPU_X64_XS
    AUTO_RESUME = TRUE AUTO_SUSPEND_SECS = 300;

  CREATE WAREHOUSE IF NOT EXISTS IDENTIFIER(:wh_name)
    WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE;

  SHOW SERVICES LIKE 'SC360_SERVICE' IN SCHEMA services;
  svc_count := (SELECT COUNT(*) FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())));

  IF (:svc_count = 0) THEN
    CREATE SERVICE services.sc360_service
      IN COMPUTE POOL IDENTIFIER(:pool_name)
      FROM SPECIFICATION_FILE = '/service_spec.yml'
      MIN_INSTANCES = 1 MAX_INSTANCES = 1;
    GRANT USAGE ON SERVICE services.sc360_service TO APPLICATION ROLE app_public;
    GRANT SERVICE ROLE services.sc360_service!sc360_role TO APPLICATION ROLE app_public;
  ELSE
    ALTER SERVICE services.sc360_service FROM SPECIFICATION_FILE = '/service_spec.yml';
    CALL SYSTEM$WAIT_FOR_SERVICES(600, 'services.sc360_service');
  END IF;
  RETURN 'version_init ok';
END;
$$;
GRANT USAGE ON PROCEDURE core.version_init() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.suspend_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.sc360_service SUSPEND; RETURN 'Service suspended'; END; $$;
GRANT USAGE ON PROCEDURE core.suspend_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.resume_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.sc360_service RESUME; RETURN 'Service resumed'; END; $$;
GRANT USAGE ON PROCEDURE core.resume_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_status()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE status VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_STATUS('services.sc360_service') INTO :status; RETURN :status; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_status() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_logs(instance_id STRING, container_name STRING)
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE logs VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_LOGS('services.sc360_service', :instance_id, :container_name, 200) INTO :logs; RETURN :logs; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_logs(STRING, STRING) TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.app_url()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE url VARCHAR;
BEGIN
  SHOW ENDPOINTS IN SERVICE services.sc360_service;
  SELECT "ingress_url" INTO :url FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'sc360';
  RETURN :url;
END; $$;
GRANT USAGE ON PROCEDURE core.app_url() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.selftest()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE kpi_rows INTEGER; plant_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO :kpi_rows FROM app_data.DT_MANUFACTURING_KPI;
  SELECT COUNT(*) INTO :plant_rows FROM app_data.A_PLANT;
  RETURN 'bundled data OK — DT_MANUFACTURING_KPI=' || :kpi_rows || ' rows, A_PLANT=' || :plant_rows || ' rows';
END; $$;
GRANT USAGE ON PROCEDURE core.selftest() TO APPLICATION ROLE app_public;
