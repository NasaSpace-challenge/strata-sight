
import assert from 'node:assert/strict';

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const VARIABLES = [
    {
        id: 'merra2_t2m',
        dataset: 'NASA/GSFC/MERRA/slv/2'
    },
    {
        id: 'gpm_precip',
        dataset: 'NASA/GPM_L3/IMERG_MONTHLY_V07'
    },
    {
        id: 'gldas_soil_moist',
        dataset: 'NASA/GLDAS/V021/NOAH/G025/T3H'
    },
    {
        id: 'modis_ndvi',
        dataset: 'MODIS/061/MOD13Q1'
    }
];

async function testVariable(variable) {
    console.log(`\nTesting ${variable.id}...`);

    const url = new URL('/api/timeseries', BASE_URL);

    url.searchParams.set('variable', variable.id);
    url.searchParams.set('lat', '28.61');
    url.searchParams.set('lon', '77.20');
    url.searchParams.set('start', '2001');
    url.searchParams.set('end', '2024');

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `${variable.id}: HTTP ${response.status} - ${data.error || 'Unknown error'}`
        );
    }

    assert.equal(data.variable, variable.id);
    assert.equal(data.datasetId, variable.dataset);
    assert.equal(data.dates.length, 288);
    assert.equal(data.values.length, 288);

    assert.equal(data.dates[0], '2001-01');
    assert.equal(data.dates[287], '2024-12');

   const missingValues = data.values
    .map((value, index) => ({
        date: data.dates[index],
        value
    }))
    .filter(item =>
        typeof item.value !== 'number' ||
        !Number.isFinite(item.value)
    );

console.log('Total monthly records:', data.values.length);
console.log('Missing measurements:', missingValues.length);

if (missingValues.length > 0) {
    console.log(
        'First missing months:',
        missingValues.slice(0, 20).map(item => item.date)
    );
}

if (missingValues.length === 0) {
    console.log('All measurements are valid.');
} else {
    console.warn(
        'Some months have no valid observations. Investigate before using this series.'
    );
}
    assert.equal(data.source, 'Google Earth Engine');

    console.log('PASS:', variable.id);
    console.log('Dataset:', data.datasetId);
    console.log('First measurement:', data.values[0]);
    console.log('Last measurement:', data.values[287]);
    console.log('Monthly records:', data.values.length);
}

async function runTests() {
    console.log('Starting StrataSight dataset tests...');

    for (const variable of VARIABLES) {
        await testVariable(variable);
    }

    console.log('\nALL FOUR DATASET TESTS PASSED.');
}

runTests().catch(error => {
    console.error('\nDATASET TEST FAILED:');
    console.error(error);
    process.exitCode = 1;
});
