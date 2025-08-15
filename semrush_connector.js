const axios = require('axios');
const OpenAIConnector = require('./openai_connector');

class SemrushConnector {
    constructor(apiKey, openaiConnector) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.semrush.com/';
        this.openaiConnector = openaiConnector;
    }

    /**
     * Analyze client information to extract key topics and themes for keyword research
     * @param {Object} clientInfo - Client information from the form
     * @param {Object} campaignContext - Selected campaign context (name, objective, budget)
     * @param {Object} adGroupContext - Selected ad group context (name, theme, target audience)
     * @returns {Promise<Object>} - Analysis results with topics and search terms
     */
    async analyzeClientInfo(clientInfo, campaignContext = null, adGroupContext = null) {
        try {
            console.log('\n=== ANALYZE CLIENT INFO ===');
            console.log('Input clientInfo:', clientInfo);
            console.log('Input campaignContext:', campaignContext);
            console.log('Input adGroupContext:', adGroupContext);
            
            // Check if this is a unit type campaign (empty clientInfo and campaignContext, only adGroupContext.name)
            const isUnitTypeCampaign = (!clientInfo || Object.keys(clientInfo).length === 0) && 
                                       !campaignContext && 
                                       adGroupContext && 
                                       adGroupContext.name;

            // Check if this is a General Search campaign (isUnitType=false) with Location ad group
            const isGeneralSearchCampaign = campaignContext && 
                                           campaignContext.isUnitType === false && 
                                           adGroupContext && 
                                           adGroupContext.name === 'Location';
                                           
            console.log('Campaign type detection:');
            console.log('- isUnitTypeCampaign:', isUnitTypeCampaign);
            console.log('- isGeneralSearchCampaign:', isGeneralSearchCampaign);
            console.log('===========================\n');

            if (isGeneralSearchCampaign) {
                // For General Search campaigns, generate location-based keywords
                console.log('General Search campaign detected. Generating location-based keywords.');
                
                const locationPrompt = [
                    {
                        role: "system",
                        content: `You are a keyword research specialist for General Search real estate campaigns. Your task is to generate location-based keywords that cover the 4 main classifications:

1. Location - Direct location-based terms
2. New Apts - New apartment/property related terms
3. Near - Proximity-based terms (near, close to, by)
4. Access To - Access/connectivity terms (access to, walking distance to, minutes from)

Generate keywords that attract users searching for apartments or homes with language about:
- Nearby locations (downtown, neighborhoods, landmarks)
- Public works (transit, utilities, infrastructure)
- Schools (elementary, high school, college)
- Amenities (shopping, dining, entertainment)
- Must cover: client name, price point, amenities, nearby locations

Return JSON with:
- coreTopics: array of 4-6 location-based topics
- industryTerms: array of 6-10 real estate location terms
- seedKeywords: array of 15-20 location-focused keywords
- targetingInsights: description of location targeting strategy`
                    },
                    {
                        role: "user",
                        content: `Generate General Search location-based keywords for:

Client Information:
- Client Name: ${clientInfo.clientName || clientInfo.name || 'Property Management'}
- Location: ${clientInfo.geographicTargeting || 'Metropolitan Area'}
- Industry: ${clientInfo.industry || 'Real Estate'}
- Target Audience: ${clientInfo.targetAudience || 'Apartment/Home Seekers'}
- Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'Quality Living'}
- Price Point: ${clientInfo.budget || 'Competitive Pricing'}

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Budget: ${campaignContext.budget || 'Not specified'}

Focus on creating keywords that cover:
1. **Location**: Direct location terms (e.g., "apartments downtown [city]", "[neighborhood] homes")
2. **New Apts**: New construction terms (e.g., "new apartments [location]", "newly built homes")
3. **Near**: Proximity terms (e.g., "apartments near [landmark]", "homes close to [area]")
4. **Access To**: Connectivity terms (e.g., "apartments walking distance to [transit]", "homes with access to [amenities]")

Generate keywords that would attract searchers looking for properties in the specified location with nearby amenities, schools, and public works.`
                    }
                ];

                const analysis = await this.openaiConnector.generateResponse(locationPrompt, 'gpt-4o');
                const analysisData = this.parseJsonResponse(analysis);
                
                console.log('General Search campaign analysis completed:', analysisData);
                return analysisData;
            }

            if (isUnitTypeCampaign) {
                // For unit type campaigns, generate keywords strictly based on ad group name
                const adGroupName = adGroupContext.name;
                console.log('Unit type campaign detected. Using ad group name only:', adGroupName);
                
                const unitTypePrompt = [
                    {
                        role: "system",
                        content: `You are a keyword research specialist for real estate/property unit type campaigns. Your task is to generate keyword variations and related terms based STRICTLY on the ad group name provided.

For unit type campaigns like "4 bedroom house", "3 bedroom apartment", etc., generate:
1. Direct variations of the ad group name
2. Related property search terms
3. Intent-based variations (for sale, for rent, new, etc.)
4. Location-agnostic terms that could apply anywhere

Return JSON with:
- coreTopics: array of 3-5 core property types/categories
- industryTerms: array of 5-8 real estate related terms
- seedKeywords: array of 10-15 keyword variations based on the ad group name
- targetingInsights: brief description of what searchers would be looking for`
                    },
                    {
                        role: "user",
                        content: `Generate keyword research terms based ONLY on this ad group name: "${adGroupName}"

Focus on creating variations like:
- Direct matches (e.g., "4 bedroom homes")
- Property type variations (e.g., "4 bedroom house", "4 bedroom townhouse")
- Search intent variations (e.g., "4 bedroom homes for sale", "new 4 bedroom houses")
- Feature variations (e.g., "4 bed 4 bath homes", "four bedroom properties")

Do NOT include any business names, locations, or unrelated terms. Focus strictly on property/unit type keywords.`
                    }
                ];

                const analysis = await this.openaiConnector.generateResponse(unitTypePrompt, 'gpt-4o');
                const analysisData = this.parseJsonResponse(analysis);
                
                console.log('Unit type campaign analysis completed:', analysisData);
                return analysisData;
            }

            // Original logic for regular campaigns
            // Build enhanced context for analysis
            let contextInfo = `Client Information:
- Client Name: ${clientInfo.clientName || 'N/A'}
- Industry: ${clientInfo.industry || 'N/A'}
- Target Audience: ${clientInfo.targetAudience || 'N/A'}
- Geographic Targeting: ${clientInfo.geographicTargeting || 'N/A'}
- Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'N/A'}
- Competitors: ${clientInfo.competitors || 'N/A'}
- Brand Voice: ${clientInfo.brandVoice || 'N/A'}`;

            if (campaignContext) {
                contextInfo += `

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Not specified'}
- Campaign Budget: ${campaignContext.budget || 'Not specified'}`;
            }

            if (adGroupContext) {
                contextInfo += `

Ad Group Context:
- Ad Group Name: ${adGroupContext.name}
- Ad Group Theme: ${adGroupContext.theme || 'Not specified'}
- Ad Group Target Audience: ${adGroupContext.targetAudience || 'Not specified'}`;
            }

            const analysisPrompt = [
                {
                    role: "system",
                    content: `You are a keyword research strategist specializing in Google Ads campaign optimization. Analyze the provided client information and campaign context to extract the most relevant topics, themes, and seed keywords for keyword research using Semrush.

Your task is to:
1. Identify core business topics aligned with campaign goals
2. Extract relevant industry terms specific to the campaign/ad group focus
3. Generate targeted seed keywords that align with campaign objectives and ad group themes
4. Consider geographic and demographic targeting
5. Focus on keywords that will work well for both keyword targeting AND ad copy creation

${campaignContext ? 'IMPORTANT: Pay special attention to the campaign context and tailor keywords to support the campaign objective.' : ''}
${adGroupContext ? 'IMPORTANT: Focus keywords specifically around the ad group theme and target audience for maximum relevance.' : ''}

Return your response as a JSON object with:
- coreTopics: array of 3-5 main business topics aligned with campaign goals
- industryTerms: array of 5-8 relevant industry keywords that fit the campaign context
- seedKeywords: array of 8-12 targeted seed keywords optimized for this specific campaign/ad group
- geoModifiers: array of location-based modifiers if applicable
- targetingInsights: brief description of target audience keywords to focus on
- campaignAlignment: how these keywords support the campaign objective (if campaign context provided)
- adGroupAlignment: how these keywords fit the ad group theme (if ad group context provided)`
                },
                {
                    role: "user", 
                    content: `Analyze this information for targeted keyword research:

${contextInfo}

Focus on extracting terms that would be valuable for finding relevant keywords in Semrush that align with the specific campaign strategy and ad group focus.`
                }
            ];

            const analysis = await this.openaiConnector.generateResponse(analysisPrompt, 'gpt-4o');
            
            // Parse the JSON response - handle both pure JSON and markdown-wrapped JSON
            const analysisData = this.parseJsonResponse(analysis);
            
            console.log('Enhanced client info analysis completed:', analysisData);
            return analysisData;
            
        } catch (error) {
            console.error('Error analyzing client info:', error);
            throw new Error('Failed to analyze client information for keyword research');
        }
    }

    /**
     * Parse JSON response from OpenAI, handling both pure JSON and markdown-wrapped JSON
     * @param {string} response - Raw response from OpenAI
     * @returns {Object} - Parsed JSON object
     */
    parseJsonResponse(response) {
        try {
            // First try to parse as pure JSON
            return JSON.parse(response);
        } catch (error) {
            try {
                // If that fails, try to extract JSON from markdown code blocks
                const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    return JSON.parse(jsonMatch[1].trim());
                }
                
                // If no code blocks, try to find JSON object in the response
                const objectMatch = response.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    return JSON.parse(objectMatch[0]);
                }
                
                throw new Error('No valid JSON found in response');
            } catch (parseError) {
                console.error('Failed to parse JSON response:', response);
                console.error('Parse error:', parseError);
                throw new Error(`Invalid JSON response: ${parseError.message}`);
            }
        }
    }

    /**
     * Search for keywords using Semrush Keyword Magic Tool
     * @param {string} keyword - Seed keyword to search for
     * @param {string} database - Country database (default: 'us')
     * @param {number} limit - Number of keywords to return (default: 50)
     * @returns {Promise<Array>} - Array of keyword objects
     */
    async searchKeywords(keyword, database = 'us', limit = 50) {
        try {
            const params = {
                type: 'phrase_all',
                phrase: keyword,
                database: database,
                export_columns: 'Ph,Nq,Cp,Co,Nr,Td',
                display_limit: limit,
                key: this.apiKey
            };

            // Use the correct Semrush API endpoint format
            const response = await axios.get(this.baseUrl, {
                params: params,
                timeout: 30000
            });

            return this.parseKeywordData(response.data);
            
        } catch (error) {
            console.error('Error fetching keywords from Semrush:', error.message);
            console.error('Full error response:', error.response?.data);
            throw new Error('Failed to fetch keywords from Semrush API');
        }
    }

    /**
     * Get keyword suggestions for multiple seed keywords
     * @param {Array} seedKeywords - Array of seed keywords
     * @param {string} database - Country database
     * @param {number} limitPerKeyword - Limit per seed keyword
     * @returns {Promise<Array>} - Combined and deduplicated keyword results
     */
    async getKeywordSuggestions(seedKeywords, database = 'us', limitPerKeyword = 50) {
        const allKeywords = [];
        const promises = [];

        // Search for keywords for each seed term
        for (const seedKeyword of seedKeywords) {
            promises.push(
                this.searchKeywords(seedKeyword, database, limitPerKeyword)
                    .then(results => {
                        console.log(`✅ Keywords found for "${seedKeyword}": ${results.length}`);
                        return results;
                    })
                    .catch(error => {
                        console.warn(`❌ Failed to fetch keywords for "${seedKeyword}":`, error.message);
                        return []; // Return empty array on error to continue with other keywords
                    })
            );
        }

        try {
            const results = await Promise.all(promises);
            
            // Combine all results
            for (const keywordSet of results) {
                allKeywords.push(...keywordSet);
            }

            // Remove duplicates and sort by search volume
            const uniqueKeywords = this.deduplicateKeywords(allKeywords);
            return this.prioritizeKeywords(uniqueKeywords);
            
        } catch (error) {
            console.error('Error getting keyword suggestions:', error);
            throw new Error('Failed to get keyword suggestions');
        }
    }

    /**
     * Generate keyword recommendations based on client info analysis
     * @param {Object} clientInfo - Client information
     * @param {Object} campaignContext - Selected campaign context (optional)
     * @param {Object} adGroupContext - Selected ad group context (optional)
     * @returns {Promise<Object>} - Organized keyword recommendations
     */
    async generateKeywordRecommendations(clientInfo, campaignContext = null, adGroupContext = null) {
        try {
            console.log('\n=== SEMRUSH KEYWORD GENERATION ===');
            console.log('Client info:', clientInfo);
            console.log('Campaign context:', campaignContext);
            console.log('Ad group context:', adGroupContext);
            
            // Step 1: Analyze client info with campaign context to get search terms
            const analysis = await this.analyzeClientInfo(clientInfo, campaignContext, adGroupContext);
            console.log('Analysis completed:', analysis);
            
            // Step 2: Combine all potential search terms
            const allSearchTerms = [
                ...analysis.coreTopics,
                ...analysis.industryTerms,
                ...analysis.seedKeywords
            ];
            console.log('All search terms:', allSearchTerms);

            // Step 3: Get keyword suggestions from Semrush
            const keywordSuggestions = await this.getKeywordSuggestions(allSearchTerms);
            console.log('Keyword suggestions from Semrush:', keywordSuggestions.length, 'keywords');

            // Step 4: Organize and categorize results with enhanced context
            const result = {
                analysis: analysis,
                campaignContext: campaignContext,
                adGroupContext: adGroupContext,
                keywords: {
                    highVolume: keywordSuggestions.filter(kw => kw.searchVolume > 500),
                    mediumVolume: keywordSuggestions.filter(kw => kw.searchVolume >= 100 && kw.searchVolume <= 500),
                    lowVolume: keywordSuggestions.filter(kw => kw.searchVolume < 100 && kw.searchVolume > 0),
                    lowCompetition: keywordSuggestions.filter(kw => kw.competition < 0.3),
                    all: keywordSuggestions.slice(0, 200)
                },
                recommendations: {
                    primaryKeywords: keywordSuggestions.slice(0, 10),
                    longTail: keywordSuggestions.filter(kw => kw.keyword.split(' ').length >= 3).slice(0, 15),
                    branded: keywordSuggestions.filter(kw => 
                        clientInfo.clientName && 
                        kw.keyword.toLowerCase().includes(clientInfo.clientName.toLowerCase())
                    )
                }
            };

            // Add campaign-specific insights if context provided
            if (campaignContext || adGroupContext) {
                result.contextualInsights = {
                    campaignAlignment: analysis.campaignAlignment || 'No campaign context provided',
                    adGroupAlignment: analysis.adGroupAlignment || 'No ad group context provided',
                    recommendedFocus: this.generateContextualRecommendations(analysis, campaignContext, adGroupContext)
                };
            }

            return result;
            
        } catch (error) {
            console.error('Error generating keyword recommendations:', error);
            throw new Error('Failed to generate keyword recommendations');
        }
    }

    /**
     * Parse raw keyword data from Semrush API response
     * @param {string} rawData - Raw CSV-like response from Semrush
     * @returns {Array} - Parsed keyword objects
     */
    parseKeywordData(rawData) {
        try {
            console.log('=== PARSING RAW DATA ===');
            console.log('Raw data:', rawData);
            
            // Check for error responses
            if (rawData.includes('ERROR') || rawData.includes('NOTHING FOUND')) {
                console.log('⚠️ Semrush returned error or no results:', rawData);
                return [];
            }
            
            const lines = rawData.trim().split('\n');
            console.log('Lines count:', lines.length);
            console.log('Header:', lines[0]);
            
            const keywords = [];

            for (let i = 1; i < lines.length; i++) { // Skip header row
                const parts = lines[i].split(';');
                console.log(`Line ${i} parts (${parts.length}):`, parts);
                
                // Accept 5 or more columns (trends column might be missing)
                if (parts.length >= 5) {
                    const keyword = {
                        keyword: parts[0].replace(/"/g, ''),
                        searchVolume: parseInt(parts[1]) || 0,
                        cpc: parseFloat(parts[2]) || 0,
                        competition: parseFloat(parts[3]) || 0,
                        results: parseInt(parts[4]) || 0,
                        intent: parts[5] || 'informational' // Default if trends column missing
                    };
                    
                    console.log('✅ Parsed keyword:', keyword);
                    keywords.push(keyword);
                } else {
                    console.log('❌ Skipping line with insufficient columns:', parts);
                }
            }

            console.log('Total parsed keywords:', keywords.length);
            console.log('========================');
            return keywords;
        } catch (error) {
            console.error('Error parsing keyword data:', error);
            return [];
        }
    }

    /**
     * Remove duplicate keywords
     * @param {Array} keywords - Array of keyword objects
     * @returns {Array} - Deduplicated keywords
     */
    deduplicateKeywords(keywords) {
        const seen = new Set();
        return keywords.filter(keyword => {
            const key = keyword.keyword.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Prioritize keywords based on search volume, competition, and relevance
     * @param {Array} keywords - Array of keyword objects
     * @returns {Array} - Prioritized keywords
     */
    prioritizeKeywords(keywords) {
        return keywords.sort((a, b) => {
            // Primary sort: search volume (higher is better)
            if (b.searchVolume !== a.searchVolume) {
                return b.searchVolume - a.searchVolume;
            }
            
            // Secondary sort: competition (lower is better)
            return a.competition - b.competition;
        });
    }

    /**
     * Test API connection
     * @returns {Promise<boolean>} - True if connection successful
     */
    async testConnection() {
        try {
            // Test with a simple keyword search
            await this.searchKeywords('marketing', 'us', 1);
            return true;
        } catch (error) {
            console.error('Semrush API connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Generate contextual recommendations based on campaign and ad group analysis
     * @param {Object} analysis - AI analysis results
     * @param {Object} campaignContext - Campaign context
     * @param {Object} adGroupContext - Ad group context
     * @returns {string} - Contextual recommendations
     */
    generateContextualRecommendations(analysis, campaignContext, adGroupContext) {
        let recommendations = [];

        if (campaignContext) {
            recommendations.push(`Campaign "${campaignContext.name}" focus: Prioritize keywords that align with the campaign objective.`);
        }

        if (adGroupContext) {
            recommendations.push(`Ad Group "${adGroupContext.name}" theme: Focus on keywords that match the ad group's specific targeting.`);
        }

        if (analysis.targetingInsights) {
            recommendations.push(`Targeting insight: ${analysis.targetingInsights}`);
        }

        return recommendations.join(' ');
    }
}

module.exports = SemrushConnector; 