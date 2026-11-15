
import ee from '@google/earthengine';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_DIR = path.dirname(fileURLToPath(import.meta.url));

/*
 * StrataSight - NASA Earth Engine Data Integration
 *
 * Four real datasets:
 * 1. MERRA-2 temperature
 * 2. GPM IMERG V07 precipitation
 * 3. GLDAS Noah soil moisture
 * 4. MODIS NDVI
 *
 * Output: monthly time series.
 */

const PROJECT_ID =
    process.env.EE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;

const KEY_FILE = process.env.EE_SERVICE_ACCOUNT_KEY_FILE;

let initializationPromise = null;

const DATASETS = {
    merra2_t2m: {
        collection: 'NASA/GSFC/MERRA/slv/2',
        band: 'T2M',
        scale: 69375,
        unit: '°C',
        description: 'MERRA-2 2-meter air temperature'
    },

    gpm_precip: {
        collection: 'NASA/GPM_L3/IMERG_MONTHLY_V07',
        band: 'precipitation',
        scale: 11132,
        unit: 'mm/month',
        description: 'GPM IMERG V07 monthly precipitation'
    },

    gldas_soil_moist: {
        collection: 'NASA/GLDAS/V021/NOAH/G025/T3H',
        bands: [
            'SoilMoi0_10cm_inst',
            'SoilMoi10_40cm_inst',
            'SoilMoi40_100cm_inst'
        ],
        scale: 27830,
        unit: 'kg/m²',
        description: 'GLDAS Noah 0-100cm root-zone soil moisture'
    },

    modis_ndvi: {
        collection: 'MODIS/061/MOD13Q1',
        band: 'NDVI',
        scale: 250,
        unit: 'Index',
        description: 'MODIS Terra vegetation index'
    }
};


/*
 * Initialize Google Earth Engine once.
 */

async function initializeEarthEngine() {

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {

        try {

            if (!PROJECT_ID) {
                throw new Error(
                    'Missing EE_PROJECT_ID or GOOGLE_CLOUD_PROJECT.'
                );
            }

            if (!KEY_FILE) {
                throw new Error(
                    'Missing EE_SERVICE_ACCOUNT_KEY_FILE.'
                );
            }

            const cwdCandidate = path.resolve(process.cwd(), KEY_FILE);
            const keyPath = fs.existsSync(cwdCandidate)
                ? cwdCandidate
                : path.resolve(BACKEND_DIR, KEY_FILE);

            if (!fs.existsSync(keyPath)) {
                throw new Error(
                    `Earth Engine service account key not found: ${keyPath}`
                );
            }

            const privateKey = JSON.parse(
                fs.readFileSync(keyPath, 'utf8')
            );

            if (!privateKey || !privateKey.client_email || !privateKey.private_key) {
                const err = new Error(
                    'Earth Engine service account key file is an empty placeholder ({}). Populate backend/ee-service-account.json with valid credentials; falling back to zero-auth NASA POWER / Multi-Agency Telemetry.'
                );
                err.status = 503;
                throw err;
            }

            ee.data.authenticateViaPrivateKey(
                privateKey,

                () => {

                    ee.initialize(
                        null,
                        null,

                        () => {
                            console.log(
                                '[Earth Engine] Initialized successfully.'
                            );
                            resolve();
                        },

                        (error) => {
                            reject(error);
                        },

                        null,
                        privateKey.project_id || PROJECT_ID
                    );

                },

                (error) => {
                    reject(error);
                }
            );

        } catch (error) {
            reject(error);
        }

    });

    try {
        await initializationPromise;
    } catch (error) {
        initializationPromise = null;
        throw error;
    }
}


/*
 * Cheap, memoized health probe. Earth Engine can initialize successfully yet still
 * reject every computation (e.g. the Cloud project is not registered for EE), so we
 * evaluate a trivial server-side value once and remember the verdict for 10 minutes.
 */
let healthCache = null;
const HEALTH_TTL_MS = 10 * 60 * 1000;

export async function earthEngineHealth() {
    if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) {
        return healthCache.result;
    }

    let result;
    try {
        await initializeEarthEngine();
        await evaluateEarthEngine(ee.Number(1));
        result = { ok: true };
    } catch (error) {
        result = { ok: false, reason: String(error?.message || error) };
    }

    healthCache = { at: Date.now(), result };
    return result;
}


/*
 * Convert Earth Engine asynchronous evaluate() into a Promise.
 */

function evaluateEarthEngine(computedObject) {

    return new Promise((resolve, reject) => {

        computedObject.evaluate(
            (result) => resolve(result),
            (error) => reject(error)
        );

    });
}


/*
 * Build a monthly image for the selected variable.
 */

function createMonthlyImage(variable, images, startDate, endDate) {

    switch (variable) {

        // MERRA-2: hourly temperature in Kelvin.
        case 'merra2_t2m':

            return images
                .select('T2M')
                .mean()
                .subtract(273.15)
                .rename('value');


        // GPM: monthly mean precipitation rate in mm/hour.
        // Convert rate into total monthly precipitation in mm.
        case 'gpm_precip':

            return images
                .select('precipitation')
                .mean()
                .multiply(endDate.difference(startDate, 'hour'))
                .rename('value');


        // GLDAS: sum the monthly mean water storage
        // in the 0-10cm, 10-40cm and 40-100cm layers.
        case 'gldas_soil_moist':

            return images
                .select([
                    'SoilMoi0_10cm_inst',
                    'SoilMoi10_40cm_inst',
                    'SoilMoi40_100cm_inst'
                ])
                .mean()
                .reduce(ee.Reducer.sum())
                .rename('value');


        // MODIS: filter poor-quality observations and
        // convert the stored integer NDVI to its real scale.
        case 'modis_ndvi': {

            const qualityFiltered = images.map((image) => {

                const goodQuality = image
                    .select('SummaryQA')
                    .lte(1);

                return image
                    .updateMask(goodQuality)
                    .select('NDVI')
                    .multiply(0.0001)
                    .rename('value');

            });

            return qualityFiltered
                .mean()
                .rename('value');
        }

        default:
            throw new Error(`Unsupported variable: ${variable}`);
    }
}


/*
 * Retrieve a monthly time series for one location.
 */

export async function getTimeSeries(
    variable,
    lat,
    lon,
    startYear = 2001,
    endYear = 2024
) {

    if (!DATASETS[variable]) {
        const error = new Error(
            `Unsupported variable: ${variable}`
        );
        error.status = 400;
        throw error;
    }

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
    ) {
        const error = new Error('Invalid latitude or longitude.');
        error.status = 400;
        throw error;
    }

    if (
        !Number.isInteger(startYear) ||
        !Number.isInteger(endYear) ||
        startYear < 2000 ||
        endYear < startYear ||
        endYear > new Date().getUTCFullYear() ||
        endYear - startYear > 30
    ) {
        const error = new Error('Invalid date range.');
        error.status = 400;
        throw error;
    }

    await initializeEarthEngine();

    const config = DATASETS[variable];

    const point = ee.Geometry.Point([lon, lat]);

    const totalMonths =
        (endYear - startYear + 1) * 12;

    const firstMonth = ee.Date.fromYMD(
        startYear,
        1,
        1
    );

    /*
     * Construct all months on the Earth Engine server.
     * This avoids making a separate network request
     * for every month.
     */

    const monthlyFeatures = ee.List.sequence(
        0,
        totalMonths - 1
    ).map((offset) => {

        const monthStart = firstMonth.advance(
            offset,
            'month'
        );

        const monthEnd = monthStart.advance(
            1,
            'month'
        );

        const images = ee.ImageCollection(
            config.collection
        ).filterDate(
            monthStart,
            monthEnd
        );

        const monthlyImage = createMonthlyImage(
            variable,
            images,
            monthStart,
            monthEnd
        );

        const statistics = monthlyImage.reduceRegion({

            reducer: ee.Reducer.first(),

            geometry: point,

            scale: config.scale,

            maxPixels: 100000000,

            tileScale: 4

        });

        return ee.Feature(null, {

            date: monthStart.format('YYYY-MM'),

            value: statistics.get('value')

        });

    });

    const featureCollection = ee.FeatureCollection(
        monthlyFeatures
    );

    const result = await evaluateEarthEngine(
        featureCollection
    );

    if (!result || !Array.isArray(result.features)) {
        throw new Error(
            `No Earth Engine results returned for ${variable}.`
        );
    }

    const dates = result.features.map(
        feature => feature.properties.date
    );

    const values = result.features.map(feature => {

        const value = feature.properties.value;

        return (
            typeof value === 'number' &&
            Number.isFinite(value)
        )
            ? value
            : null;

    });

    console.log(
        `[Earth Engine] ${variable}: ${values.length} monthly records`
    );

    return {

        variable,

        dates,

        values,

        source: 'Google Earth Engine',

        datasetId: config.collection,

        description: config.description,

        unit: config.unit

    };

}
