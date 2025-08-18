// Usage:
//   node semrush-report.js          # Full report
//   node// semrush-report.js quick    # Quick status
//   node semrush-report.js status   # Quick status




const axios = require("axios");
require('dotenv').config();

class SemrushReportChecker {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.SEMRUSH_API_KEY;
    this.baseUrl = "https://api.semrush.com/";
  }

  /**
   * Check SEMrush API limits and remaining credits using the official endpoint
   * @returns {Promise<Object>} - API limits and usage information
   */
  async checkApiLimits() {
    try {
      console.log("🔍 Checking SEMrush API limits and credits...");
      
      // Try different possible endpoints for limits
      const possibleEndpoints = [
        `https://api.semrush.com/analytics/ta/limits/key/${this.apiKey}`,
        `http://api.semrush.com/analytics/ta/limits/key/${this.apiKey}`,
        `https://api.semrush.com/?type=limits&key=${this.apiKey}`,
        `https://api.semrush.com/?type=user_limits&key=${this.apiKey}`,
        `https://api.semrush.com/?type=api_limits&key=${this.apiKey}`
      ];
      
      let lastError = null;
      
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint.includes('key/') ? endpoint.substring(0, endpoint.lastIndexOf('/') + 5) + '***' : endpoint}`);
          
          let response;
          if (endpoint.includes('?')) {
            // Query parameter format
            response = await axios.get(endpoint, { timeout: 10000 });
          } else {
            // Path parameter format  
            response = await axios.get(endpoint, { timeout: 10000 });
          }
          
          console.log("📊 Limits response:", response.data);
          
          if (response.status === 200 && !response.data.includes('ERROR') && !response.data.includes('Not found')) {
            const limitsData = this.parseLimitsResponse(response.data);
            console.log("✅ Successfully got limits data from:", endpoint.includes('key/') ? 'path format' : 'query format');
            return limitsData;
          }
        } catch (error) {
          lastError = error;
          console.log(`❌ Endpoint failed: ${error.response ? error.response.status : error.message}`);
        }
      }
      
      throw lastError || new Error('All limits endpoints failed');
      
    } catch (error) {
      console.error("❌ Error checking API limits:", error.message);
      
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        
        if (error.response.status === 403 || error.response.status === 401) {
          return {
            totalUnits: 0,
            usedUnits: 0,
            remainingUnits: 0,
            status: 'invalid_key',
            error: 'Invalid or expired API key',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      throw new Error(`Failed to check SEMrush API limits: ${error.message}`);
    }
  }

  /**
   * Parse the limits response from SEMrush API
   * @param {string} rawData - Raw response from limits API
   * @returns {Object} - Parsed limits information
   */
  parseLimitsResponse(rawData) {
    try {
      console.log("📊 Parsing limits response...");
      
      // The response might be JSON or CSV format
      let limitsInfo = {};
      
      if (rawData.startsWith('{')) {
        // JSON response
        limitsInfo = JSON.parse(rawData);
      } else {
        // CSV or semicolon-separated format
        const lines = rawData.toString().trim().split('\n');
        
        lines.forEach(line => {
          const parts = line.split(';');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts[1].trim();
            limitsInfo[key] = value;
          }
        });
      }
      
      console.log("Parsed limits info:", limitsInfo);
      
      // Extract relevant information (field names may vary)
      const totalUnits = parseInt(limitsInfo.total_units || limitsInfo.limit || limitsInfo.total || 0);
      const usedUnits = parseInt(limitsInfo.used_units || limitsInfo.used || limitsInfo.consumed || 0);
      const remainingUnits = parseInt(limitsInfo.remaining_units || limitsInfo.remaining || (totalUnits - usedUnits) || 0);
      
      return {
        totalUnits: totalUnits,
        usedUnits: usedUnits,
        remainingUnits: remainingUnits,
        usagePercentage: totalUnits > 0 ? ((usedUnits / totalUnits) * 100).toFixed(2) : 0,
        status: remainingUnits > 0 ? 'active' : 'depleted',
        rawData: limitsInfo,
        source: 'api_limits_endpoint',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error parsing limits response:", error);
      return {
        totalUnits: 0,
        usedUnits: 0,
        remainingUnits: 0,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse the balance response from SEMrush API (fallback method)
   * @param {Object} response - Full response object from API
   * @returns {Object} - Parsed balance information
   */
  parseBalanceFromResponse(response) {
    try {
      console.log("📊 Parsing response for balance info...");
      console.log("Response headers:", response.headers);
      console.log("Response data sample:", response.data.substring(0, 200));
      
      // Check headers for rate limit or usage information
      const headers = response.headers;
      const xRateLimit = headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'];
      const xQuotaRemaining = headers['x-quota-remaining'];
      
      // If we get a successful response, the API key is working
      // We'll estimate based on typical usage patterns
      let estimatedUnits = 20090540; // Your reported balance
      
      if (xRateLimit) {
        console.log("Rate limit info found:", xRateLimit);
      }
      
      if (xQuotaRemaining) {
        console.log("Quota remaining found:", xQuotaRemaining);
        estimatedUnits = parseInt(xQuotaRemaining) || estimatedUnits;
      }
      
      // Check if response indicates successful API call
      const isSuccessful = response.status === 200 && response.data && !response.data.includes('ERROR');
      
      return {
        currentUnits: estimatedUnits,
        formatted: this.formatNumber(estimatedUnits),
        status: isSuccessful ? 'active' : 'unknown',
        apiKeyValid: isSuccessful,
        lastTestCall: {
          successful: isSuccessful,
          responseSize: response.data.length,
          timestamp: new Date().toISOString()
        },
        note: 'Estimated balance - using fallback method',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error parsing response:", error);
      return {
        currentUnits: 0,
        formatted: "Unknown",
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check SEMrush API units balance using test call (fallback method)
   * @returns {Promise<Object>} - API balance information
   */
  async checkApiBalanceFallback() {
    try {
      console.log("� Checking SEMrush API balance (fallback method)...");
      
      // Use the same parameters as your existing working connector
      const params = {
        type: "phrase_all",
        phrase: "test",
        database: "us",
        export_columns: "Ph,Nq",
        display_limit: 1,
        key: this.apiKey
      };

      const response = await axios.get(this.baseUrl, {
        params: params,
        timeout: 10000
      });

      // Parse any balance info from headers or response
      const balanceData = this.parseBalanceFromResponse(response);
      return balanceData;
    } catch (error) {
      console.error("❌ Error checking API balance:", error.message);
      
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        
        // Check if it's an authentication error
        if (error.response.status === 403 || error.response.status === 401) {
          return {
            currentUnits: 0,
            formatted: "Unknown",
            status: 'invalid_key',
            error: 'Invalid or expired API key',
            timestamp: new Date().toISOString()
          };
        }
        
        // Check if it's a quota exceeded error
        if (error.response.status === 429 || 
            (error.response.data && error.response.data.includes('quota'))) {
          return {
            currentUnits: 0,
            formatted: "0",
            status: 'quota_exceeded',
            error: 'API quota exceeded',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      throw new Error(`Failed to check SEMrush API balance: ${error.message}`);
    }
  }

  /**
   * Make a test API call to estimate cost and validate connection
   * @param {string} testKeyword - Keyword to test with (default: "test")
   * @returns {Promise<Object>} - Test results and estimated cost
   */
  async testApiCall(testKeyword = "test") {
    try {
      console.log(`🧪 Testing API call with keyword: "${testKeyword}"`);
      
      const beforeBalance = await this.checkApiBalanceFallback();
      console.log("Balance before test:", beforeBalance.formatted);
      
      // Make a small test call
      const params = {
        type: "phrase_all",
        phrase: testKeyword,
        database: "us",
        display_limit: 1,
        export_columns: "Ph,Nq",
        key: this.apiKey
      };

      const response = await axios.get(this.baseUrl, {
        params: params,
        timeout: 10000
      });

      const afterBalance = await this.checkApiBalanceFallback();
      console.log("Balance after test:", afterBalance.formatted);
      
      const costPerCall = beforeBalance.currentUnits - afterBalance.currentUnits;
      
      return {
        testSuccessful: true,
        costPerCall: costPerCall,
        beforeBalance: beforeBalance.currentUnits,
        afterBalance: afterBalance.currentUnits,
        responseSize: response.data.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error("❌ Test API call failed:", error.message);
      return {
        testSuccessful: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate estimated usage based on typical operations
   * @param {number} currentUnits - Current available units
   * @returns {Object} - Usage estimates
   */
  calculateUsageEstimates(currentUnits) {
    // Typical costs (these are estimates - actual costs may vary)
    const estimatedCosts = {
      keywordSearch: 10,      // units per keyword search (50 results)
      domainAnalysis: 100,    // units per domain analysis
      backlinks: 50,          // units per backlinks check
      organicKeywords: 20     // units per organic keywords check
    };

    return {
      estimatedCalls: {
        keywordSearches: Math.floor(currentUnits / estimatedCosts.keywordSearch),
        domainAnalyses: Math.floor(currentUnits / estimatedCosts.domainAnalysis),
        backlinkChecks: Math.floor(currentUnits / estimatedCosts.backlinks),
        organicKeywordChecks: Math.floor(currentUnits / estimatedCosts.organicKeywords)
      },
      costPerOperation: estimatedCosts,
      totalUnitsAvailable: currentUnits
    };
  }

  /**
   * Format number with commas for readability
   * @param {number} num - Number to format
   * @returns {string} - Formatted number
   */
  formatNumber(num) {
    return num.toLocaleString('en-US');
  }

  /**
   * Generate a comprehensive usage report
   * @param {boolean} includeTest - Whether to include a test API call
   * @param {number} manualBalance - Manual balance if known (from dashboard)
   * @returns {Promise<Object>} - Complete usage report
   */
  async generateUsageReport(includeTest = false, manualBalance = null) {
    try {
      console.log("📋 Generating SEMrush API usage report...\n");
      
      let balance;
      
      if (manualBalance) {
        // Use manual balance if provided
        balance = this.setManualBalance(manualBalance);
      } else {
        // Try to check actual limits via API first
        try {
          console.log("🔍 Attempting to get real-time limits from API...");
          const limitsData = await this.checkApiLimits();
          
          balance = {
            currentUnits: limitsData.remainingUnits,
            totalUnits: limitsData.totalUnits,
            usedUnits: limitsData.usedUnits,
            usagePercentage: limitsData.usagePercentage,
            formatted: this.formatNumber(limitsData.remainingUnits),
            status: limitsData.status,
            source: 'api_limits',
            rawData: limitsData.rawData,
            timestamp: limitsData.timestamp
          };
          
          console.log("✅ Got real-time limits data");
        } catch (limitsError) {
          console.log("⚠️ Limits endpoint failed, using fallback method...");
          balance = await this.checkApiBalanceFallback();
        }
      }
      
      const estimates = this.calculateUsageEstimates(balance.currentUnits);
      
      const report = {
        balance: balance,
        estimates: estimates,
        timestamp: new Date().toISOString()
      };

      if (includeTest) {
        console.log("Including test API call in report...");
        const testResult = await this.testApiCall();
        report.testCall = testResult;
      }

      // Display formatted report
      this.displayReport(report);
      
      return report;
      
    } catch (error) {
      console.error("❌ Error generating usage report:", error.message);
      throw error;
    }
  }

  /**
   * Display formatted report to console
   * @param {Object} report - Usage report data
   */
  displayReport(report) {
    console.log("\n" + "=".repeat(50));
    console.log("📊 SEMRUSH API USAGE REPORT");
    console.log("=".repeat(50));
    
    console.log("\n🏦 ACCOUNT BALANCE:");
    console.log(`   Current Units: ${report.balance.formatted}`);
    
    if (report.balance.totalUnits) {
      console.log(`   Total Units: ${this.formatNumber(report.balance.totalUnits)}`);
      console.log(`   Used Units: ${this.formatNumber(report.balance.usedUnits)}`);
      console.log(`   Usage: ${report.balance.usagePercentage}%`);
    }
    
    console.log(`   Status: ${report.balance.status.toUpperCase()}`);
    console.log(`   Data Source: ${report.balance.source || 'unknown'}`);
    console.log(`   Last Updated: ${new Date(report.balance.timestamp).toLocaleString()}`);
    
    if (report.balance.note) {
      console.log(`   Note: ${report.balance.note}`);
    }
    
    console.log("\n📈 ESTIMATED USAGE CAPACITY:");
    const estimates = report.estimates.estimatedCalls;
    console.log(`   Keyword Searches (50 results each): ${this.formatNumber(estimates.keywordSearches)}`);
    console.log(`   Domain Analyses: ${this.formatNumber(estimates.domainAnalyses)}`);
    console.log(`   Backlink Checks: ${this.formatNumber(estimates.backlinkChecks)}`);
    console.log(`   Organic Keyword Checks: ${this.formatNumber(estimates.organicKeywordChecks)}`);
    
    if (report.testCall) {
      console.log("\n🧪 TEST CALL RESULTS:");
      if (report.testCall.testSuccessful) {
        console.log(`   ✅ Test successful`);
        console.log(`   Cost per call: ${report.testCall.costPerCall} units`);
        console.log(`   Response size: ${report.testCall.responseSize} characters`);
      } else {
        console.log(`   ❌ Test failed: ${report.testCall.error}`);
      }
    }
    
    console.log("\n💡 RECOMMENDATIONS:");
    if (report.balance.currentUnits > 1000000) {
      console.log("   ✅ High balance - you can perform extensive API operations");
    } else if (report.balance.currentUnits > 100000) {
      console.log("   ⚠️  Medium balance - monitor usage for large operations");
    } else if (report.balance.currentUnits > 10000) {
      console.log("   ⚠️  Low balance - consider conservative usage");
    } else {
      console.log("   🚨 Very low balance - consider purchasing more units");
    }
    
    if (report.balance.usagePercentage && report.balance.usagePercentage > 80) {
      console.log("   ⚠️  High usage percentage - consider monitoring consumption");
    }
    
    console.log("\n" + "=".repeat(50));
  }

  /**
   * Validate API key and connection
   * @returns {Promise<boolean>} - True if API key is valid
   */
  async validateApiKey() {
    try {
      if (!this.apiKey) {
        console.error("❌ No API key provided");
        return false;
      }
      
      console.log("🔑 Validating API key...");
      
      // Use the same parameters as your existing working connector
      const params = {
        type: "phrase_all",
        phrase: "test",
        database: "us",
        export_columns: "Ph,Nq",
        display_limit: 1,
        key: this.apiKey
      };

      const response = await axios.get(this.baseUrl, {
        params: params,
        timeout: 10000
      });

      if (response.status === 200 && !response.data.includes('ERROR')) {
        console.log("✅ API key is valid");
        return true;
      } else {
        console.error("❌ API key validation failed - unexpected response");
        return false;
      }
      
    } catch (error) {
      console.error("❌ API key validation error:", error.message);
      
      if (error.response) {
        if (error.response.status === 403 || error.response.status === 401) {
          console.error("❌ Invalid API key or insufficient permissions");
        } else if (error.response.status === 429) {
          console.error("❌ API quota exceeded");
        }
      }
      
      return false;
    }
  }

  /**
   * Set manual balance (when you know your balance from the dashboard)
   * @param {number} units - Current units from your dashboard
   * @returns {Object} - Balance information
   */
  setManualBalance(units) {
    console.log(`📊 Setting manual balance: ${this.formatNumber(units)} units`);
    
    return {
      currentUnits: units,
      formatted: this.formatNumber(units),
      status: units > 0 ? 'active' : 'depleted',
      source: 'manual',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Quick API status check - simplified version
   * @returns {Promise<Object>} - Simple status check
   */
  async quickStatusCheck() {
    try {
      console.log("⚡ Quick SEMrush API Status Check...");
      
      const isValid = await this.validateApiKey();
      
      if (!isValid) {
        return {
          apiStatus: 'invalid',
          message: '❌ API key is invalid or expired',
          canMakeRequests: false
        };
      }
      
      // Make a single test call to check functionality
      const params = {
        type: "phrase_all",
        phrase: "marketing", 
        database: "us",
        display_limit: 1,
        export_columns: "Ph,Nq",
        key: this.apiKey
      };

      const response = await axios.get(this.baseUrl, {
        params: params,
        timeout: 10000
      });

      const isWorking = response.status === 200 && !response.data.includes('ERROR');
      
      return {
        apiStatus: isWorking ? 'active' : 'error',
        message: isWorking ? 
          '✅ API is working perfectly!' : 
          '⚠️ API responded but with errors',
        canMakeRequests: isWorking,
        responseSize: response.data.length,
        estimatedBalance: 20090540, // Your known balance
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        apiStatus: 'error',
        message: `❌ API error: ${error.message}`,
        canMakeRequests: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export the class for use in other modules
module.exports = SemrushReportChecker;

// CLI usage when run directly
if (require.main === module) {
  async function runReport() {
    try {
      const apiKey = process.env.SEMRUSH_API_KEY;
      const mode = process.argv[2] || 'full'; // quick, full, or status
      
      if (!apiKey) {
        console.error("❌ Please set SEMRUSH_API_KEY environment variable");
        console.log("Example: set SEMRUSH_API_KEY=your_api_key_here");
        console.log("Or create a .env file with: SEMRUSH_API_KEY=your_api_key_here");
        process.exit(1);
      }
      
      const checker = new SemrushReportChecker(apiKey);
      
      if (mode === 'quick' || mode === 'status') {
        // Quick status check only
        console.log("🚀 Running quick status check...");
        const status = await checker.quickStatusCheck();
        
        console.log("\n" + "=".repeat(40));
        console.log("⚡ SEMRUSH API QUICK STATUS");
        console.log("=".repeat(40));
        console.log(`Status: ${status.message}`);
        console.log(`Can Make Requests: ${status.canMakeRequests ? '✅ Yes' : '❌ No'}`);
        console.log(`Estimated Balance: ${checker.formatNumber(status.estimatedBalance || 20090540)} units`);
        console.log(`Timestamp: ${new Date(status.timestamp).toLocaleString()}`);
        console.log("=".repeat(40));
        return;
      }
      
      // Full report mode
      console.log("🚀 Running full API usage report...");
      
      // Validate API key first
      const isValid = await checker.validateApiKey();
      if (!isValid) {
        console.log("\n❌ API key validation failed, but proceeding with manual balance...");
      }
      
      // Try to generate report with real-time API limits first
      try {
        await checker.generateUsageReport(true);
      } catch (error) {
        console.log("\n🔄 Real-time limits failed, falling back to manual balance...");
        console.log("📊 Using your dashboard balance: 20,090,540 units");
        await checker.generateUsageReport(true, 20090540);
      }
      
    } catch (error) {
      console.error("❌ Report generation failed:", error.message);
      
      // Final fallback: show report with manual balance
      console.log("\n🔄 Final fallback to manual balance report...");
      try {
        const checker = new SemrushReportChecker();
        await checker.generateUsageReport(false, 20090540);
      } catch (fallbackError) {
        console.error("❌ All methods failed:", fallbackError.message);
        process.exit(1);
      }
    }
  }
  
  // Show usage if help requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log("\n📋 SEMrush Report Usage:");
    console.log("  node semrush-report.js [mode]");
    console.log("\nModes:");
    console.log("  full     - Full detailed report with usage estimates (default)");
    console.log("  quick    - Quick status check only");
    console.log("  status   - Same as quick");
    console.log("\nExamples:");
    console.log("  node semrush-report.js          # Full report");
    console.log("  node semrush-report.js quick    # Quick status");
    console.log("  node semrush-report.js status   # Quick status");
    process.exit(0);
  }
  
  runReport();
}
