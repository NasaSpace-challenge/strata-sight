import { PromptConfig, Content } from './interface';

/**
 * Runtime Configuration:
 * This object contains the specific model parameters, system instructions, and
 * tools that the generated application MUST use for its own AI-powered features.
 * Import this object directly into your application code.
 */
export const runtimeConfig: PromptConfig = {
  "title": "NASA Earth Science Data Analysis Challenge",
  "description": "",
  "parameters": {
    "tokenLimits": 1048576,
    "groundingPromptConfig": {
      "disabled": false,
      "groundingConfig": {
        "sources": [
          {
            "type": "WEB"
          },
          {
            "type": "MAPS",
            "mapsConfig": {
              "isPlacesEnabled": true,
              "isRoutingEnabled": true
            }
          }
        ]
      }
    },
    "tools": [
      {
        "googleSearch": {}
      },
      {
        "googleMaps": {
          "groundingTypes": {
            "places": {},
            "routing": {}
          }
        }
      }
    ],
    "toolConfig": {
      "retrievalConfig": {
        "languageCode": "en_US"
      }
    },
    "thinkingBudget": null,
    "thinkingLevel": "MEDIUM",
    "safetyCatFilters": [
      {
        "category": "HATE_SPEECH",
        "threshold": "OFF"
      },
      {
        "category": "DANGEROUS_CONTENT",
        "threshold": "OFF"
      },
      {
        "category": "SEXUALLY_EXPLICIT_CONTENT",
        "threshold": "OFF"
      },
      {
        "category": "HARASSMENT_CONTENT",
        "threshold": "OFF"
      }
    ]
  },
  "type": "chat",
  "examples": [],
  "model": "google/gemini-4-argon"
};

/**
 * Build-Time Context:
 * This chat history is provided as a reference for the model during application
 * generation. It is used to understand the user's intent and the desired
 * functionality of the AI.
 *
 * IMPORTANT: This conversation history MAY OR MAY NOT be 
 * included in the runtime calls of the final generated application based on
 * the user's intent and desired behavior.
 */
export const buildContextMessages: Content[] = [
  {
    "author": "user",
    "content": {
      "role": "user",
      "parts": [
        {
          "text": "Event2026 NASA Space Apps ChallengeDifficultyAdvancedSubjectsEarth ScienceSoftwareChange is always occurring in the Earth’s interconnected environmental system, and when it runs in a consistent direction – rising or falling, increasing or decreasing, thickening or thinning – measured variables reflect it. But a measured Earth science data variable can trend one way in one region and the opposite way in another, even when the same process drives both. The multitude of Earth science data variables makes it difficult to select variables that could indicate change, and to then perform an analysis on the selected variables. Your challenge is to create a tool that can select variables measured by Earth science missions or produced by Earth science models, visualize how they change over time, and determine what is changing, where it is changing, how much it is changing, and if these changes are what scientists call “significant.”\n\nBackgroundInstruments on satellites observe many different aspects of the Earth system: on land, in the atmosphere, and in the oceans. Global models also use satellite instrument data and other kinds of data to examine and analyze the Earth system. One important reason for doing this is to observe and characterize changes in the Earth system. Changes, especially those moving in a particular direction over time – a trend – indicate both the processes causing such changes and the processes that will respond to them.\nOne complicating factor in this work is the wide variety of variables that can be studied. Another is that changes in a particular variable can move in one direction in one region and in the opposite direction in another, even when both trends are caused by the same process! So there are two important parts to this problem: finding variables that are trending, from simple ones like temperature and rainfall to more complex ones like evaporation or streamflow; and analyzing trends in particular regions of the land, ocean, or even levels of the atmosphere.\nInstruments such as the Moderate Resolution Imaging Spectroradiometer (MODIS), the Ozone Monitoring Instrument (OMI), the Atmospheric Infrared Sounder (AIRS), and the Global Precipitation Measurement (GPM) provide analyzable variables. Global models – notably the Modern Era Retrospective analysis for Research and Applications, Version 2 (MERRA-2) and the Global Land Data Assimilation System (GLDAS) – provide many more. Finding, analyzing, and relating significant trends to the processes causing them is one of the most important uses of NASA Earth science data.ObjectivesA successful response to this challenge will bring together several important elements.\nThe first is to identify Earth science variables of interest that can be investigated for potential trends. As the Background notes, NASA and other space agencies offer numerous variables, some familiar and some more specialized for use by particular branches of science.\nThe second is to acquire the data variables for a particular region, since most trends in the data will not be global – though some trends can be!\nThe third is to generate and visualize a time series for the variable and region of interest over a long enough period of time to allow statistical analysis.\nThe final element of the challenge is to perform a basic statistical analysis of that time series, indicating the rate of change over time, and to test the trend’s significance using methods such as a t-test, the Mann-Kendall test, or confidence intervals.\nData sites offer tools that generate time series, and statistical analysis packages provide basic significance testing. A response that does both the visualization and the analysis meets the full scope of this challenge.Potential ConsiderationsYou may (but are not required to) consider the following:Audience\nThis challenge involves science data and statistical analysis, so the likely audience is high school and college students, along with members of the public who have some scientific background.\nProviding simple definitions of the variables would help these users considerably.\nThe concept is to help the users become data detectives – finding variables of interest, then determining whether those variables show a trend and whether that trend is significant.Approach\nUsers could potentially respond to a short series of questions about what or where they would like to investigate, and then the answers to the questions would allow searching of related data variables. It would be highly useful to provide a couple of demonstration examples that the user could watch and would help them understand how the tool works.\nWhile not required, SI could be useful here to identify data with the potential to show trends in particular areas, drawing on either news articles and research papers or the characteristics of a region such as a desert, rain forest, tidal estuary, or the atmosphere above a large city.Working with the data\nEarth science data are available at several different temporal resolutions – hourly, 3-hourly, daily, and monthly. For this challenge, daily and monthly data are likely the easiest to process.\nFinding a trend is interesting even if it doesn’t reach the level of significance. Sometimes all a trend needs to become significant is a longer period for the data to be acquired.\nConsider looking for publicly available tools for plotting hydrological data offered by outside organizations like the Consortium of Universities for the Advancement of Hydrologic Science, Inc. (CUAHSI).\nTrend analysis with Earth science data can be complex. Trends can be non-linear, and some are not evident unless regular cycles, such as the seasonal cycle, are removed. More complex trend analyses are beyond the scope envisioned for this challenge; detecting and analyzing linear trends would be a great start.For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.\n"
        }
      ]
    }
  },
  {
    "author": "bot",
    "content": {
      "role": "model",
      "parts": [
        {
          "text": "You have shared the full prompt for an **Advanced Earth Science & Software** challenge from the **2026 NASA Space Apps Challenge**. \n\nTo help you win or build a standout project, here is a complete blueprint—covering **project concepts, system architecture, statistical methodology, and an implementation roadmap** tailored specifically to the judging criteria embedded in this prompt.\n\n---\n\n### 1. Core Requirements Breakdown\nTo meet the full scope of the challenge, your application must achieve four distinct objectives:\n1. **Guided Variable Selection:** Help non-expert users (\"data detectives\") navigate NASA's massive catalog (MODIS, OMI, AIRS, GPM, MERRA-2, GLDAS) and understand what the variables mean.\n2. **Regional Data Extraction:** Allow users to select a specific bounding box, point, or biome (since opposite trends can occur in different regions due to the same process).\n3. **Time-Series Visualization:** Plot long-term data (preferably monthly or daily) clearly, accounting for seasonal cycles.\n4. **Statistical Trend & Significance Analysis:** Calculate the rate of change (slope) and mathematically prove if the change is statistically \"significant\" (using Mann-Kendall, Sen’s Slope, or t-tests).\n\n---\n\n### 2. Winning Project Concept: *\"EarthPulse: The Climate Trend Detective\"*\nInstead of just building a blank dashboard with dropdown menus of cryptic variable names (like `GLDAS_NOAH025_M_2.1:SoilMoi0_10cm_inst`), build an **interactive, story-driven diagnostic tool**.\n\n* **The \"Detective\" Onboarding (Wizard):** Ask the user 3 simple questions:\n  1. *Where do you want to investigate?* (Interactive map with preset hotspots like the Amazon Rainforest, Aral Sea, Arctic Circle, or custom bounding box).\n  2. *What sphere of Earth interests you?* (Land & Water, Atmosphere & Air Quality, Heat & Energy).\n  3. *What phenomenon are you curious about?* (e.g., Drought, Urban Pollution, Vegetation Greening, Glacial Melt).\n* **Plain-English Translator:** Map their answers to specific NASA variables and show a \"Variable Trading Card\" with a high-school-level definition, the satellite/model source, and why it matters.\n* **The \"Dual-Region Paradox\" Mode (Bonus Feature):** The prompt specifically mentions that *a variable can trend one way in one region and the opposite way in another due to the same process*. Allow users to compare two regions side-by-side (e.g., precipitation increasing in one area while decreasing in a neighboring area due to shifting atmospheric circulation).\n\n---\n\n### 3. Recommended Tech Stack & Data Pipeline\n\nFetching raw NetCDF/HDF5 files from NASA Earthdata takes too long for a live web app. Here is how to make it fast during a 48-hour hackathon:\n\n#### **Data Sources & APIs (Fastest for Hackathons)**\n* **NASA Giovanni / GES DISC API:** Ideal for MERRA-2, GPM, GLDAS, and AIRS time-series data.\n* **Google Earth Engine (GEE) Python API:** By far the easiest way to query MODIS, GLDAS, and GPM over a custom polygon and instantly return a monthly time-series JSON without downloading gigabytes of raw files.\n* **NASA AppEEARS API:** Great for extracting point or polygon time-series data for MODIS and land variables.\n* **Pre-cached Demo Datasets:** **Crucial Hackathon Tip:** Pre-download 5–10 CSV/JSON time series for your \"Demonstration Examples\" so your live demo works instantaneously even if NASA APIs throttle or lag.\n\n#### **Backend & Statistics (Python)**\n* **Framework:** `FastAPI` or `Streamlit` (Streamlit is great for rapid prototyping; React + FastAPI is better for custom UI/UX).\n* **Data Processing:** `xarray`, `pandas`, `numpy`.\n* **Statistical Engine:** \n  * `pymannkendall` (Python library specifically built for Mann-Kendall trend tests and Sen's slope).\n  * `scipy.stats` (for linear regression, t-tests, p-values, and confidence intervals).\n  * `statsmodels.tsa.seasonal.seasonal_decompose` (to strip out the seasonal summer/winter cycle so the true long-term linear trend is visible!).\n\n#### **Frontend & Visualization**\n* **Map Interface:** `Mapbox GL JS`, `Leaflet`, or `Deck.gl` (for drawing regional bounding boxes).\n* **Charts:** `Plotly.js` or `Recharts` (allows plotting the raw data, the deseasonalized data, the trendline, and the shaded 95% confidence interval cone).\n\n---\n\n### 4. How to Implement the Statistical Analysis (The \"Secret Sauce\")\n\nJudges will look closely at how you handle the math. In Earth science, standard linear regression often fails because climate data has strong seasonal cycles and outliers. Implement a **3-step automated pipeline**:\n\n1. **Deseasonalization (Anomaly Calculation):**\n   * Raw monthly temperature or rainfall just looks like a sine wave going up and down every year.\n   * Calculate the **Monthly Anomaly**: Subtract the 30-year average for each specific month (e.g., average of all Januaries) from each data point. Now the seasonal wave disappears, and the true trend emerges.\n2. **Trend Detection (Mann-Kendall Test):**\n   * Use the **Mann-Kendall test** (explicitly mentioned in the prompt). It is a non-parametric test that doesn't require the data to be normally distributed and is the gold standard in hydrology and climatology.\n   * Output: Tells the user *Increasing Trend*, *Decreasing Trend*, or *No Trend*.\n3. **Rate of Change & Significance:**\n   * **Rate of Change:** Use **Sen’s Slope** or **Ordinary Least Squares (OLS) Slope** to tell the user the exact physical change (e.g., *\"+0.04°C per year\"* or *\"-1.2 cm of groundwater per year\"*).\n   * **Significance Badge:** Check if the $p\\text{-value} < 0.05$ (95% confidence level). Display a clear UI badge: \n     * 🟢 **Statistically Significant ($p < 0.01$):** *\"Scientists are >99% confident this change is not a random fluctuation.\"*\n     * 🟡 **Emerging Trend ($0.05 < p < 0.15$):** *\"A trend is visible, but a longer time period is needed to rule out natural variability.\"* (Directly addresses the prompt's consideration!)\n     * ⚪ **No Significant Trend ($p > 0.15$):** *\"Data appears stable or dominated by short-term noise.\"*\n\n---\n\n### 5. Pre-Built \"Demo Case Studies\" to Include\nThe prompt strongly recommends providing demonstration examples users can watch or click through. Build these 3 presets right onto your home screen:\n\n1. **Case Study 1: The Drying vs. Wetting Paradox (GLDAS / GPM)**\n   * *Variable:* Soil Moisture & Precipitation.\n   * *Regions:* Southwestern US (drying trend) vs. Northern Europe/Monsoon regions (wetting trend).\n   * *Lesson:* Shows how a warming atmosphere holds more moisture, intensifying both droughts and heavy rainfall depending on geography.\n2. **Case Study 2: The Clean Air Recovery (OMI - Ozone Monitoring Instrument)**\n   * *Variable:* Tropospheric $\\text{NO}_2$ (Nitrogen Dioxide).\n   * *Regions:* Los Angeles / Western Europe (significant downward trend due to emissions regulations) vs. rapidly industrializing megacities (upward trend).\n3. **Case Study 3: Arctic Amplification & Greening (MODIS & AIRS)**\n   * *Variable:* Surface Skin Temperature (AIRS) & Normalized Difference Vegetation Index - NDVI (MODIS).\n   * *Region:* Northern Alaska / Siberia.\n   * *Lesson:* Demonstrates how rising temperatures directly correlate with \"Arctic Greening\" (shrubs expanding into tundra).\n\n---\n\n### How would you like to proceed?\nTell me where your team is right now, and I can generate the exact materials you need:\n1. **Write the Python code** for the statistical pipeline (Mann-Kendall, t-test, seasonal removal, and Plotly visualization).\n2. **Design the UI/UX wireframe and user flow** for the \"Data Detective\" web app.\n3. **Write a script/API fetcher** to pull MERRA-2, MODIS, or GLDAS data from NASA Earthdata or Google Earth Engine.\n4. **Draft your 3-minute pitch script and slide deck structure** for the judges."
        }
      ]
    }
  }
];

// Media Data Variables:

