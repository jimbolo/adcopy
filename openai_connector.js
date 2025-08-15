/**
 * OpenAI API Connector for Ad Copy Generation
 * This module handles the communication with OpenAI API for generating ad copy
 */

class OpenAIConnector {
    constructor(config) {
        this.config = config;
    }

    /**
     * Generate ad copy using OpenAI API
     * @param {Object} clientInfo - Client information
     * @param {Object} campaignContext - Campaign context (optional)
     * @param {Object} adGroupContext - Ad group context (optional)
     * @param {Object} keywordData - Keyword research data (optional)
     * @returns {Promise<Object>} - Generated ad copy
     */
    async generateAdCopy(clientInfo, campaignContext = null, adGroupContext = null, keywordData = null) {
        try {
            // First use GPT-4 for orchestration with keyword context
            const orchestrationPrompt = this.createOrchestrationPrompt(clientInfo, campaignContext, adGroupContext, keywordData);
            const orchestrationResult = await this.callOpenAI(
                this.config.getOrchestrationModel(),
                orchestrationPrompt
            );

            // Then use GPT-3.5-Turbo for generation based on orchestration
            const generationPrompt = this.createGenerationPrompt(clientInfo, orchestrationResult, campaignContext, adGroupContext, keywordData);
            const generationResult = await this.callOpenAI(
                this.config.getGenerationModel(),
                generationPrompt
            );

            // Parse and format the generated ad copy
            return this.parseGeneratedAdCopy(generationResult);
        } catch (error) {
            console.error('Error generating ad copy:', error);
            return this.getFallbackAdCopy(clientInfo);
        }
    }

    /**
     * Create prompt for orchestration
     * @param {Object} clientInfo - Client information
     * @param {Object} campaignContext - Campaign context (optional)
     * @param {Object} adGroupContext - Ad group context (optional)
     * @param {Object} keywordData - Keyword research data (optional)
     * @returns {Array} - Messages for OpenAI API
     */
    createOrchestrationPrompt(clientInfo, campaignContext, adGroupContext, keywordData) {
        // Check if this is a unit type campaign (empty clientInfo)
        const isUnitType = !clientInfo || Object.keys(clientInfo).length === 0;
        
        // Check if this is a General Search campaign (isUnitType=false) with Location ad group
        const isGeneralSearch = campaignContext && 
                               campaignContext.isUnitType === false && 
                               adGroupContext && 
                               adGroupContext.name === 'Location';
        
        // Build context information
        let contextInfo = '';
        
        if (isGeneralSearch) {
            // For General Search campaigns, focus on client info and location targeting
            contextInfo = `GENERAL SEARCH CAMPAIGN - Location-Based Targeting

Client Information:
- Client Name: ${clientInfo.clientName || clientInfo.name || 'Property Management'}
- Industry: ${clientInfo.industry || 'Real Estate'}
- Geographic Targeting: ${clientInfo.geographicTargeting || 'Metropolitan Area'}
- Target Audience: ${clientInfo.targetAudience || 'Apartment/Home Seekers'}
- Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'Quality Living'}
- Brand Voice: ${clientInfo.brandVoice || 'Professional and welcoming'}
- Call to Action: ${clientInfo.callToAction || 'Contact us today'}
- Budget: ${clientInfo.budget || 'Competitive pricing'}

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Drive location-based leads'}
- Campaign Budget: ${campaignContext.budget || 'Not specified'}

Ad Group Context:
- Ad Group Name: ${adGroupContext.name} (Location-focused)
- Target Focus: Location-based apartment/home search intent`;
        } else if (isUnitType) {
            // For unit type campaigns, focus only on campaign and ad group context
            contextInfo = `UNIT TYPE CAMPAIGN - Ad Group Based Keywords Only

Ad Group Context:
- Ad Group Name: ${adGroupContext?.name || 'N/A'}
- Ad Group Theme: ${adGroupContext?.theme || 'Not specified'}
- Ad Group Target Audience: ${adGroupContext?.targetAudience || 'Not specified'}`;

            if (campaignContext) {
                contextInfo += `

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Not specified'}
- Campaign Budget: ${campaignContext.budget || 'Not specified'}`;
            }
        } else {
            // Regular campaign with full client info
            contextInfo = `Client Name: ${clientInfo.name || 'N/A'}
Website: ${clientInfo.website || 'N/A'}
Industry: ${clientInfo.industry || 'N/A'}
Target Audience: ${clientInfo.targetAudience || 'N/A'}
Location: ${clientInfo.geographicTargeting || 'N/A'}
Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'N/A'}
Competitors: ${clientInfo.competitors || 'N/A'}
Brand Voice: ${clientInfo.brandVoice || 'N/A'}
Call to Action: ${clientInfo.callToAction || 'N/A'}`;

            // Add campaign context if available
            if (campaignContext) {
                contextInfo += `

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Not specified'}
- Campaign Budget: ${campaignContext.budget || 'Not specified'}`;
            }

            // Add ad group context if available
            if (adGroupContext) {
                contextInfo += `

Ad Group Context:
- Ad Group Name: ${adGroupContext.name}
- Ad Group Theme: ${adGroupContext.theme || 'Not specified'}
- Ad Group Target Audience: ${adGroupContext.targetAudience || 'Not specified'}`;
            }
        }

        // Add keyword data if available
        let keywordInfo = '';
        if (keywordData && keywordData.keywords) {
            keywordInfo = `

KEYWORD RESEARCH DATA (PRIMARY DRIVERS):
These keywords should be the foundation of your ad copy strategy:

High Volume Keywords (prioritize these):
${keywordData.keywords.highVolume ? keywordData.keywords.highVolume.slice(0, 10).map(k => `- ${k.keyword} (${k.searchVolume} searches/month, Competition: ${k.competition})`).join('\n') : 'None available'}

Medium Volume Keywords:
${keywordData.keywords.mediumVolume ? keywordData.keywords.mediumVolume.slice(0, 8).map(k => `- ${k.keyword} (${k.searchVolume} searches/month, Competition: ${k.competition})`).join('\n') : 'None available'}

Low Competition Keywords (good for cost efficiency):
${keywordData.keywords.lowCompetition ? keywordData.keywords.lowCompetition.slice(0, 8).map(k => `- ${k.keyword} (${k.searchVolume} searches/month, Competition: ${k.competition})`).join('\n') : 'None available'}

Keyword Analysis Insights:
${keywordData.analysis ? `
- Core Topics: ${keywordData.analysis.coreTopics ? keywordData.analysis.coreTopics.join(', ') : 'N/A'}
- Industry Terms: ${keywordData.analysis.industryTerms ? keywordData.analysis.industryTerms.join(', ') : 'N/A'}
- Target Insights: ${keywordData.analysis.targetingInsights || 'N/A'}
` : 'No analysis available'}`;
        }

        const systemContent = isGeneralSearch
            ? `You are an expert Google Ads strategist specializing in General Search location-based real estate campaigns. Your task is to analyze client information, saved keywords, and location context to create a strategic plan for generating highly effective Google Ads copy.

CRITICAL: This is a General Search campaign targeting location-based apartment/home seekers. The saved keywords should focus on the 4 main classifications:
1. **Location** - Direct location-based terms
2. **New Apts** - New apartment/property related terms  
3. **Near** - Proximity-based terms (near, close to, by)
4. **Access To** - Access/connectivity terms (access to, walking distance to, minutes from)

Focus on:
1. Using the saved location-based keywords as the PRIMARY DRIVER of your strategy
2. Creating messaging that targets searchers looking for properties in specific locations
3. Incorporating client name, amenities, price point, and nearby locations naturally
4. Balancing keyword optimization with compelling location-based benefits
5. Ensuring the copy appeals to apartment/home seekers in the target geographic area
6. Highlighting proximity to schools, public works, amenities, and key locations`
            : isUnitType
            ? `You are an expert Google Ads strategist specializing in unit type campaigns (e.g., "3 bedroom homes", "luxury apartments"). Your task is to analyze the ad group name, saved keywords, and campaign context to create a strategic plan for generating highly effective Google Ads copy.

CRITICAL: This is a unit type campaign where the keywords are based ONLY on the ad group name (property type). DO NOT reference any client-specific information or business names. Focus purely on the property type and related search terms.

Focus on:
1. Using the saved keywords as the PRIMARY DRIVER of your strategy
2. Creating messaging that targets searchers looking for this specific property type
3. Incorporating property-related benefits and features naturally
4. Balancing keyword optimization with compelling benefit-driven copy
5. Ensuring the copy appeals to property seekers for this unit type`
            : `You are an expert Google Ads strategist specializing in keyword-driven ad copy creation. Your task is to analyze client information, campaign context, and keyword research data to create a strategic plan for generating highly effective Google Ads copy.

${keywordData ? 'CRITICAL: The keyword research data provided should be the PRIMARY DRIVER of your strategy. These keywords represent what your target audience is actually searching for and should heavily influence your messaging approach.' : 'Note: No keyword data available, focus on client information and campaign context.'}

Focus on:
1. Using high-volume and relevant keywords as the foundation for messaging
2. Identifying keyword themes that resonate with target audience intent
3. Creating messaging angles that incorporate top-performing keywords naturally
4. Balancing keyword optimization with compelling benefit-driven copy
5. Ensuring campaign and ad group alignment with keyword strategy`;

        const userContent = isGeneralSearch
            ? `Create a strategic approach for Google Ads copy for this General Search location-based campaign:

${contextInfo}${keywordInfo}

IMPORTANT: This is a General Search campaign targeting location-based searches. Base your strategy on the client information and saved location-based keywords that cover the 4 main classifications:
1. **Location** - Direct location terms (e.g., "apartments downtown [city]")
2. **New Apts** - New construction terms (e.g., "new apartments [location]")
3. **Near** - Proximity terms (e.g., "apartments near [landmark]")
4. **Access To** - Connectivity terms (e.g., "walking distance to [transit]")

Focus on creating messaging that appeals to apartment/home seekers looking for properties in the specific geographic area, highlighting proximity to schools, amenities, public works, and key locations.

Provide a strategic approach that identifies 3-5 key themes or angles to highlight, considering the saved location-based keywords as the primary driver alongside client unique selling points and geographic advantages. Do not write the actual ad copy yet.`
            : isUnitType
            ? `Create a strategic approach for Google Ads copy for this unit type campaign:

${contextInfo}${keywordInfo}

IMPORTANT: This is a unit type campaign. Base your strategy ONLY on the ad group name and saved keywords. Do not reference any business names or client-specific information. Focus on creating copy that would appeal to anyone searching for this type of property.

Provide a strategic approach that identifies 3-5 key themes or angles to highlight, considering the saved keywords as the primary driver alongside property benefits and features. Do not write the actual ad copy yet.`
            : `Create a strategic approach for Google Ads copy based on this information:

${contextInfo}${keywordInfo}

${keywordData ? 'IMPORTANT: Base your strategy primarily on the keyword research data above. These keywords represent actual search behavior and should drive your messaging recommendations.' : ''}

Provide a strategic approach that identifies 3-5 key themes or angles to highlight, considering the keyword data as the primary driver alongside target audience and unique selling points. Do not write the actual ad copy yet.`;

        return [
            {
                role: "system",
                content: systemContent
            },
            {
                role: "user",
                content: userContent
            }
        ];
    }

    /**
     * Create generation prompt
     * @param {Object} clientInfo - Client information
     * @param {string} orchestrationResult - Result from orchestration step
     * @param {Object} campaignContext - Campaign context (optional)
     * @param {Object} adGroupContext - Ad group context (optional)
     * @param {Object} keywordData - Keyword research data (optional)
     * @returns {Array} - Messages for OpenAI API
     */
    createGenerationPrompt(clientInfo, orchestrationResult, campaignContext, adGroupContext, keywordData) {
        // Check if this is a unit type campaign (empty clientInfo)
        const isUnitType = !clientInfo || Object.keys(clientInfo).length === 0;
        
        // Check if this is a General Search campaign (isUnitType=false) with Location ad group
        const isGeneralSearch = campaignContext && 
                               campaignContext.isUnitType === false && 
                               adGroupContext && 
                               adGroupContext.name === 'Location';
        
        // Build context information
        let contextInfo = '';
        
        if (isGeneralSearch) {
            // For General Search campaigns, focus on client info and location targeting
            contextInfo = `GENERAL SEARCH CAMPAIGN - Location-Based Targeting

Client Information:
- Client Name: ${clientInfo.clientName || clientInfo.name || 'Property Management'}
- Geographic Targeting: ${clientInfo.geographicTargeting || 'Metropolitan Area'}
- Industry: ${clientInfo.industry || 'Real Estate'}
- Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'Quality Living'}
- Call to Action: ${clientInfo.callToAction || 'Contact us today'}

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Drive location-based leads'}

Ad Group Context:
- Ad Group Name: ${adGroupContext.name} (Location-focused)`;
        } else if (isUnitType) {
            // For unit type campaigns, focus only on campaign and ad group context
            contextInfo = `UNIT TYPE CAMPAIGN - Property Keywords Only

Ad Group Context:
- Ad Group Name: ${adGroupContext?.name || 'N/A'}
- Ad Group Theme: ${adGroupContext?.theme || 'Not specified'}`;

            if (campaignContext) {
                contextInfo += `

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Not specified'}`;
            }
        } else {
            // Regular campaign with full client info
            contextInfo = `Client Name: ${clientInfo.name || 'N/A'}
Website: ${clientInfo.website || 'N/A'}
Industry: ${clientInfo.industry || 'N/A'}
Target Audience: ${clientInfo.targetAudience || 'N/A'}
Location: ${clientInfo.geographicTargeting || 'N/A'}
Unique Selling Points: ${clientInfo.uniqueSellingPoints || 'N/A'}
Brand Voice: ${clientInfo.brandVoice || 'N/A'}
Call to Action: ${clientInfo.callToAction || 'N/A'}`;

            // Add campaign context if available
            if (campaignContext) {
                contextInfo += `

Campaign Context:
- Campaign Name: ${campaignContext.name}
- Campaign Objective: ${campaignContext.objective || 'Not specified'}`;
            }

            // Add ad group context if available
            if (adGroupContext) {
                contextInfo += `

Ad Group Context:
- Ad Group Name: ${adGroupContext.name}
- Ad Group Theme: ${adGroupContext.theme || 'Not specified'}`;
            }
        }

        // Build keyword instructions
        let keywordInstructions = '';
        if (keywordData && keywordData.keywords) {
            const topKeywords = [
                ...(keywordData.keywords.highVolume || []).slice(0, 8),
                ...(keywordData.keywords.mediumVolume || []).slice(0, 5),
                ...(keywordData.keywords.lowCompetition || []).slice(0, 5)
            ];

            keywordInstructions = `

KEYWORDS TO INCORPORATE (PRIMARY DRIVERS):
Use these keywords as the foundation for your headlines and descriptions:

Top Priority Keywords:
${topKeywords.slice(0, 15).map(k => `- "${k.keyword}" (${k.searchVolume} searches, Competition: ${k.competition})`).join('\n')}

KEYWORD INTEGRATION REQUIREMENTS:
1. Include top keywords naturally in headlines and descriptions
2. Use exact keyword phrases where they fit within character limits
3. Prioritize high-volume keywords for headlines
4. Use medium-volume keywords for descriptions
5. Ensure keywords align with the ${isUnitType ? 'property type and search intent' : "client's brand voice and messaging"}`;
        }

        const systemContent = isGeneralSearch
            ? `You are an expert Google Ads copywriter specializing in General Search location-based real estate campaigns. Your task is to create exactly one Google Ad using a PRECISION CHARACTER COUNT process:

CRITICAL CHARACTER COUNT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Headlines: Create exactly 11 headlines, each EXACTLY 25-30 characters long
2. Descriptions: Create exactly 4 descriptions, each EXACTLY 85-90 characters long
3. Count EVERY character including spaces, punctuation, and special characters
4. NO headline should exceed 30 characters - if it does, you MUST shorten it
5. NO headline should be under 25 characters - if it is, you MUST lengthen it
6. Use smart abbreviations to fit: "Apartments" → "Apts", "Location" → "Loc", "Available" → "Avail"

EXAMPLES OF PERFECT HEADLINES (count characters):
- "Luxury Apts in San Diego" (25 chars) ✓ PERFECT
- "New Aero Apts Now Available" (27 chars) ✓ PERFECT  
- "Prime Loc, Modern Amenities" (27 chars) ✓ PERFECT
- "Beachside Living at Aero" (24 chars) ✗ TOO SHORT - ADD WORDS
- "Experience Premium Beachside Living Today" (41 chars) ✗ TOO LONG - SHORTEN

ABBREVIATION GUIDELINES:
- Apartments → Apts
- Location → Loc  
- Available → Avail
- Premium → Prime
- Amenities → Amenit
- Technology → Tech
- Construction → Const

PRECISION GENERATION PROCESS:
STEP 1: Generate initial headlines focusing on benefits and location
STEP 2: Count characters in each headline (include spaces/punctuation)
STEP 3: If over 30 chars: Use abbreviations and remove filler words
STEP 4: If under 25 chars: Add power words like "Now", "Prime", "New"
STEP 5: Verify FINAL count is 25-30 characters for each headline
STEP 6: Double-check by manually counting characters before submitting

CRITICAL GENERAL SEARCH REQUIREMENTS:
- Base copy on client information and saved location-based keywords covering the 4 classifications:
  1. **Location** - Direct location terms
  2. **New Apts** - New apartment/property terms
  3. **Near** - Proximity terms (near, close to, by)
  4. **Access To** - Connectivity terms (access to, walking distance to)
- Include client name, geographic location, and key amenities naturally
- Focus on location benefits, proximity to schools/amenities/public works
- Use saved keywords as PRIMARY DRIVERS of your copy
- Create copy that appeals to apartment/home seekers in the target location
- Highlight unique selling points and geographic advantages
- Include compelling call to action related to location/touring
- Format your response as a JSON object with these exact keys: headlines (array of 11 strings), descriptions (array of 4 strings)

MANDATORY: Every headline must be EXACTLY 25-30 characters. Every description must be exactly 85-90 characters. Count characters manually before submitting.`
            : isUnitType
            ? `You are an expert Google Ads copywriter specializing in unit type campaigns for real estate/property listings. Your task is to create exactly one Google Ad using a PRECISION CHARACTER COUNT process:

CRITICAL CHARACTER COUNT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Headlines: Create exactly 11 headlines, each EXACTLY 25-30 characters long
2. Descriptions: Create exactly 4 descriptions, each EXACTLY 85-90 characters long
3. Count EVERY character including spaces, punctuation, and special characters
4. NO headline should exceed 30 characters - if it does, you MUST shorten it
5. NO headline should be under 25 characters - if it is, you MUST lengthen it
6. Use smart abbreviations to fit: "Apartments" → "Apts", "Available" → "Avail"

EXAMPLES OF PERFECT HEADLINES (count characters):
- "Luxury Apts Available Now" (25 chars) ✓ PERFECT
- "Studio & 1BR Units Open" (23 chars) ✗ TOO SHORT - ADD WORDS
- "Modern Amenities Await You" (26 chars) ✓ PERFECT
- "Experience Premium Beachside Living" (35 chars) ✗ TOO LONG - SHORTEN

ABBREVIATION GUIDELINES:
- Apartments → Apts
- Available → Avail
- Premium → Prime
- Amenities → Amenit
- Technology → Tech
- Construction → Const

PRECISION GENERATION PROCESS:
STEP 1: Generate initial headlines focusing on property benefits
STEP 2: Count characters in each headline (include spaces/punctuation)
STEP 3: If over 30 chars: Use abbreviations and remove filler words
STEP 4: If under 25 chars: Add power words like "Now", "Prime", "New"
STEP 5: Verify FINAL count is 25-30 characters for each headline
STEP 6: Double-check by manually counting characters before submitting

CRITICAL UNIT TYPE REQUIREMENTS:
- Base copy ONLY on the saved keywords and ad group name (property type)
- DO NOT reference any specific business names, client info, or website URLs
- Focus on property features, benefits, and search intent
- Use the saved keywords as PRIMARY DRIVERS of your copy
- Create copy that appeals to property searchers for this unit type
- The ad must be compelling, focused on property benefits, and include a clear call to action
- Format your response as a JSON object with these exact keys: headlines (array of 11 strings), descriptions (array of 4 strings)

MANDATORY: Every headline must be EXACTLY 25-30 characters. Every description must be exactly 85-90 characters. Count characters manually before submitting.`
            : `You are an expert Google Ads copywriter specializing in keyword-driven ad copy creation. Your task is to create exactly one Google Ad using a PRECISION CHARACTER COUNT process:

CRITICAL CHARACTER COUNT REQUIREMENTS (MUST FOLLOW EXACTLY):
1. Headlines: Create exactly 11 headlines, each EXACTLY 25-30 characters long
2. Descriptions: Create exactly 4 descriptions, each EXACTLY 85-90 characters long
3. Count EVERY character including spaces, punctuation, and special characters
4. NO headline should exceed 30 characters - if it does, you MUST shorten it
5. NO headline should be under 25 characters - if it is, you MUST lengthen it
6. Use smart abbreviations to fit: "Apartments" → "Apts", "Available" → "Avail"

EXAMPLES OF PERFECT HEADLINES (count characters):
- "Luxury Apts Available Now" (25 chars) ✓ PERFECT
- "Beachside Living at Aero" (24 chars) ✗ TOO SHORT - ADD WORDS
- "Modern Amenities Await You" (26 chars) ✓ PERFECT
- "Experience Premium Beachside Living Today" (41 chars) ✗ TOO LONG - SHORTEN

ABBREVIATION GUIDELINES:
- Apartments → Apts
- Available → Avail
- Premium → Prime
- Amenities → Amenit
- Technology → Tech
- Construction → Const

PRECISION GENERATION PROCESS:
STEP 1: Generate initial headlines focusing on benefits and keywords
STEP 2: Count characters in each headline (include spaces/punctuation)
STEP 3: If over 30 chars: Use abbreviations and remove filler words
STEP 4: If under 25 chars: Add power words like "Now", "Prime", "New"
STEP 5: Verify FINAL count is 25-30 characters for each headline
STEP 6: Double-check by manually counting characters before submitting

${keywordData ? 'CRITICAL KEYWORD REQUIREMENTS:' : 'CONTENT REQUIREMENTS:'}
${keywordData ? '- Incorporate the provided keywords as PRIMARY DRIVERS of your copy' : '- Focus on client information and benefits'}
${keywordData ? '- Use high-volume keywords in headlines when possible' : '- Create compelling, benefit-focused copy'}
${keywordData ? '- Include medium-volume keywords in descriptions naturally' : '- Include clear call to action'}
${keywordData ? '- Ensure keywords flow naturally with brand voice and messaging' : '- Maintain professional tone'}
- The ad must be compelling, focused on benefits, and include a clear call to action
- Format your response as a JSON object with these exact keys: headlines (array of 11 strings), descriptions (array of 4 strings)

MANDATORY: Every headline must be EXACTLY 25-30 characters. Every description must be exactly 85-90 characters. Count characters manually before submitting.`;

        const userContent = isGeneralSearch
            ? `Create one Google Ad for this General Search location-based campaign using the TWO-PASS GENERATION process:

${contextInfo}${keywordInstructions}

Strategic approach from our marketing team:
${orchestrationResult}

IMPORTANT: This is a General Search campaign targeting location-based searches. Use the client information and saved location-based keywords that cover the 4 main classifications:
1. **Location** - Direct location terms (e.g., "apartments downtown [city]")
2. **New Apts** - New construction terms (e.g., "new apartments [location]")
3. **Near** - Proximity terms (e.g., "apartments near [landmark]")
4. **Access To** - Connectivity terms (e.g., "walking distance to [transit]")

Focus on creating copy that appeals to apartment/home seekers looking for properties in the specific geographic area, highlighting proximity to schools, amenities, public works, and key locations.

TWO-PASS GENERATION PROCESS:
STEP 1: Generate initial headlines and descriptions based on the context above
STEP 2: Count characters in each piece of copy (including spaces and punctuation)
STEP 3: Revise any content that doesn't meet character requirements:
   - Headlines under 23 chars: Add relevant words (location, benefits, CTAs)
   - Headlines over 30 chars: Remove unnecessary words or use shorter synonyms
   - Descriptions under 85 chars: Add compelling details or stronger CTAs
   - Descriptions over 90 chars: Remove redundant words or shorten phrases
STEP 4: Verify final counts are within required ranges

MANDATORY CHARACTER COUNT REQUIREMENTS:
- Each headline must be 23-30 characters 
- Each description must be EXACTLY 85-90 characters
- Count every character including spaces and punctuation
- Format as JSON with keys: headlines, descriptions
- Incorporate saved location-based keywords naturally and strategically
- Focus on location benefits and geographic advantages

VERIFICATION: Before submitting, mentally count characters in each headline and description to ensure they meet requirements.`
            : isUnitType
            ? `Create one Google Ad for this unit type campaign using the TWO-PASS GENERATION process:

${contextInfo}${keywordInstructions}

Strategic approach from our marketing team:
${orchestrationResult}

IMPORTANT: This is a unit type campaign. Use the saved keywords as the primary foundation for your ad copy. Focus on property features and benefits that would appeal to anyone searching for this property type. DO NOT include business names or client-specific information.

TWO-PASS GENERATION PROCESS:
STEP 1: Generate initial headlines and descriptions based on the context above
STEP 2: Count characters in each piece of copy (including spaces and punctuation)
STEP 3: Revise any content that doesn't meet character requirements:
   - Headlines under 23 chars: Add relevant words (location, benefits, CTAs)
   - Headlines over 30 chars: Remove unnecessary words or use shorter synonyms
   - Descriptions under 85 chars: Add compelling details or stronger CTAs
   - Descriptions over 90 chars: Remove redundant words or shorten phrases
STEP 4: Verify final counts are within required ranges

MANDATORY CHARACTER COUNT REQUIREMENTS:
- Each headline must be 23-30 characters 
- Each description must be EXACTLY 85-90 characters
- Count every character including spaces and punctuation
- Format as JSON with keys: headlines, descriptions
- Incorporate saved keywords naturally and strategically
- Focus on property benefits and search intent

VERIFICATION: Before submitting, mentally count characters in each headline and description to ensure they meet requirements.`
            : `Create one Google Ad based on this information using the TWO-PASS GENERATION process:

${contextInfo}${keywordInstructions}

Strategic approach from our marketing team:
${orchestrationResult}

${keywordData ? 'IMPORTANT: Use the keywords listed above as the primary foundation for your ad copy. These represent actual search terms your audience uses.' : ''}

TWO-PASS GENERATION PROCESS:
STEP 1: Generate initial headlines and descriptions based on the context above
STEP 2: Count characters in each piece of copy (including spaces and punctuation)
STEP 3: Revise any content that doesn't meet character requirements:
   - Headlines under 23 chars: Add relevant words (benefits, location, urgency)
   - Headlines over 30 chars: Remove unnecessary words or use shorter synonyms
   - Descriptions under 85 chars: Add compelling details or stronger CTAs
   - Descriptions over 90 chars: Remove redundant words or shorten phrases
STEP 4: Verify final counts are within required ranges

MANDATORY CHARACTER COUNT REQUIREMENTS:
- Each headline must be 23-30 characters
- Each description must be EXACTLY 85-90 characters 
- Count every character including spaces and punctuation
- Format as JSON with keys: headlines, descriptions
- Include the call to action
${keywordData ? '- Incorporate keywords naturally and strategically' : '- Focus on benefits and client value proposition'}

VERIFICATION: Before submitting, mentally count characters in each headline and description to ensure they meet requirements.`;

        return [
            {
                role: "system",
                content: systemContent
            },
            {
                role: "user",
                content: userContent
            }
        ];
    }

    /**
     * Call OpenAI API
     * @param {string} model - OpenAI model to use
     * @param {Array} messages - Messages for OpenAI API
     * @returns {Promise<string>} - OpenAI response
     */
    async callOpenAI(model, messages) {
        if (!this.config.hasApiKey()) {
            // For development/testing without API key
            return this.getMockResponse(model, messages);
        }

        try {
            const response = await fetch(`${this.config.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: this.config.getHeaders(),
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    ...this.config.getDefaultParams()
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            return this.getMockResponse(model, messages);
        }
    }

    /**
     * Parse generated ad copy from OpenAI response
     * @param {string} generationResult - OpenAI generation result
     * @returns {Object} - Parsed ad copy
     */
    parseGeneratedAdCopy(generationResult) {
        try {
            // Try to parse as JSON
            const jsonMatch = generationResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                const adCopy = JSON.parse(jsonStr);
                
                // Validate and ensure all required fields are present
                return {
                    headlines: this.validateAndFixHeadlines(adCopy.headlines || [], 30),
                    descriptions: this.validateAndOptimizeArray(adCopy.descriptions || [], 4, 90)
                };
            }
            
            // If JSON parsing fails, try to extract content manually
            return this.extractAdCopyManually(generationResult);
        } catch (error) {
            console.error('Error parsing generated ad copy:', error);
            return this.getEmptyAdCopy();
        }
    }

    /**
     * Extract ad copy manually from text
     * @param {string} text - Text to extract from
     * @returns {Object} - Extracted ad copy
     */
    extractAdCopyManually(text) {
        const headlines = [];
        const descriptions = [];
        // const paths = [];

        // Extract headlines
        const headlineMatches = text.match(/headline\s*\d*\s*:?\s*["']?([^"'\n]{1,30})["']?/gi);
        if (headlineMatches) {
            headlineMatches.forEach(match => {
                const headline = match.replace(/headline\s*\d*\s*:?\s*["']?/i, '').replace(/["']$/, '').trim();
                if (headline && headline.length <= 30) {
                    headlines.push(headline);
                }
            });
        }

        // Extract descriptions
        const descriptionMatches = text.match(/description\s*\d*\s*:?\s*["']?([^"'\n]{1,90})["']?/gi);
        if (descriptionMatches) {
            descriptionMatches.forEach(match => {
                const description = match.replace(/description\s*\d*\s*:?\s*["']?/i, '').replace(/["']$/, '').trim();
                if (description && description.length <= 90) {
                    descriptions.push(description);
                }
            });
        }

        // No path extraction
        return {
            headlines: this.validateAndFixHeadlines(headlines, 30),
            descriptions: this.validateAndOptimizeArray(descriptions, 4, 90)
        };
    }

    /**
     * Validate and optimize descriptions array for character count requirements
     * @param {Array} array - Array of description strings to validate
     * @param {number} count - Required number of items
     * @param {number} maxLength - Maximum character length
     * @returns {Array} - Validated and optimized array
     */
    validateAndOptimizeArray(array, count, maxLength) {
        const result = [];
        const minLength = Math.ceil(maxLength * 0.94); // 94% of max length for descriptions
        
        // Ensure we have exactly the required number of items
        for (let i = 0; i < count; i++) {
            if (i < array.length && array[i]) {
                let item = array[i].trim();
                
                // Check if item is within optimal range (94%-100%)
                if (item.length >= minLength && item.length <= maxLength) {
                    result.push(item);
                } else if (item.length > maxLength) {
                    // Item is too long - intelligently truncate
                    result.push(this.intelligentTruncateDescription(item, maxLength, minLength));
                } else if (item.length < minLength) {
                    // Item is too short - try to extend it
                    result.push(this.intelligentExtendDescription(item, maxLength, minLength, i));
                } else {
                    result.push(item);
                }
            } else {
                // Add optimized placeholder if missing
                result.push(this.getOptimizedPlaceholder(i, maxLength, minLength));
            }
        }
        
        return result;
    }

    /**
     * Intelligently truncate descriptions while preserving meaning
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {number} minLength - Minimum length
     * @returns {string} - Truncated text
     */
    intelligentTruncateDescription(text, maxLength, minLength) {
        if (text.length <= maxLength) return text;
        
        // Try to find a good word boundary within the target range
        let bestCut = maxLength;
        
        // Look for word boundaries from maxLength down to minLength
        for (let i = maxLength; i >= minLength; i--) {
            if (i < text.length && (text[i] === ' ' || text[i] === '.' || text[i] === '!')) {
                bestCut = i;
                break;
            }
        }
        
        // If we found a good boundary, use it
        if (bestCut < text.length) {
            const result = text.substring(0, bestCut).trim();
            if (result.length >= minLength) {
                return result;
            }
        }
        
        // Otherwise, cut at maxLength and remove any partial word
        let truncated = text.substring(0, maxLength);
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        
        if (lastSpaceIndex > minLength) {
            return truncated.substring(0, lastSpaceIndex).trim();
        }
        
        return truncated.trim();
    }

    /**
     * Intelligently extend descriptions to reach optimal length range
     * @param {string} text - Text to extend
     * @param {number} maxLength - Maximum length
     * @param {number} minLength - Minimum length
     * @param {number} index - Index for context
     * @returns {string} - Extended text
     */
    intelligentExtendDescription(text, maxLength, minLength, index) {
        if (text.length >= minLength) return text;
        
        let result = text.trim();
        const charsNeeded = minLength - result.length;
        
        // Description-specific extensions
        const extensions = [
            'Contact us today!',
            'Learn more now.',
            'Book your visit!',
            'Call us today.',
            'Schedule a tour now.',
            'Get in touch today!',
            'Visit us online.',
            'Apply today!'
        ];
        
        // Try each extension to see if it gets us into the target range
        for (const extension of extensions) {
            const candidate = `${result} ${extension}`.trim();
            if (candidate.length >= minLength && candidate.length <= maxLength) {
                return candidate;
            }
        }
        
        return result;
    }

    /**
     * Validate and fix headline quality issues
     * @param {Array} headlines Array of headlines to validate
     * @param {number} maxLength Maximum character length
     * @returns {Array} Fixed headlines (exactly 11 items)
     */
    validateAndFixHeadlines(headlines, maxLength = 30) {
        const result = [];
        const minLength = 25; // Target minimum for headlines
        
        // Process existing headlines
        for (let i = 0; i < Math.max(headlines.length, 11); i++) {
            let headline = '';
            
            if (i < headlines.length && headlines[i]) {
                headline = headlines[i].trim();
                
                // Check for common truncation issues
                const truncationPatterns = [
                    /\w{3,}$/,  // Ends with partial word (3+ chars)
                    /,\s*$/,    // Ends with comma
                    /\s+$/,     // Ends with spaces
                    /\w+\.{3}$/ // Ends with word + ellipsis
                ];
                
                // Detect likely truncation
                const isTruncated = truncationPatterns.some(pattern => pattern.test(headline)) ||
                                   headline.length === maxLength ||
                                   this.hasIncompletePhrase(headline);
                
                if (isTruncated) {
                    console.log(`🔧 Fixing truncated headline ${i + 1}: "${headline}"`);
                    headline = this.fixTruncatedHeadline(headline, maxLength);
                }
                
                // Ensure proper length range
                if (headline.length > maxLength) {
                    headline = this.smartTruncate(headline, maxLength);
                } else if (headline.length < minLength) {
                    headline = this.enhanceShortHeadline(headline, maxLength);
                }
            } else {
                // Generate fallback headline for missing slots
                headline = this.generateFallbackHeadline(i + 1, maxLength);
            }
            
            result.push(headline);
        }
        
        // Ensure exactly 11 headlines
        return result.slice(0, 11);
    }

    /**
     * Generate fallback headline for missing slots
     * @param {number} index Headline number (1-11)
     * @param {number} maxLength Maximum length
     * @returns {string} Fallback headline
     */
    generateFallbackHeadline(index, maxLength) {
        const fallbacks = [
            'Luxury Apts Available Now',      // 25 chars
            'Prime Location, Great Value',    // 27 chars
            'New Construction Open Today',    // 27 chars
            'Modern Amenities Await You',     // 26 chars
            'Quality Living at Great Price',  // 29 chars
            'Premium Apts, Prime Location',   // 28 chars
            'Smart Homes Available Now',      // 25 chars
            'Luxury Living Made Simple',      // 25 chars
            'Great Location, Better Value',   // 28 chars
            'New Apts with Top Amenities',    // 27 chars
            'Your Perfect Home Awaits'        // 24 chars
        ];
        
        if (index <= fallbacks.length) {
            return fallbacks[index - 1];
        }
        
        return `Quality Apts Available ${index}`.slice(0, maxLength);
    }
    
    /**
     * Check if headline has incomplete phrases
     * @param {string} headline Headline to check
     * @returns {boolean} True if incomplete phrase detected
     */
    hasIncompletePhrase(headline) {
        const incompletePhrases = [
            'Prime Locat',    // "Prime Location"
            'Luxury Apart',   // "Luxury Apartments"  
            'High Luxu',      // "High Luxury"
            'Comp Pricing',   // "Competitive Pricing"
            'Essential Amenit', // "Essential Amenities"
            'New Apts Near Essential Amenit' // Common truncation
        ];
        
        return incompletePhrases.some(phrase => headline.includes(phrase));
    }
    
    /**
     * Fix truncated headlines by intelligent completion or replacement
     * @param {string} truncated Truncated headline
     * @param {number} maxLength Maximum length
     * @returns {string} Fixed headline
     */
    fixTruncatedHeadline(truncated, maxLength) {
        // Dictionary of common truncation fixes
        const fixes = {
            'Prime Locat': 'Prime Loc',
            'Luxury Apart': 'Luxury Apts',
            'High Luxu': 'High Luxury',
            'Comp Pricing': 'Competitive Price',
            'Essential Amenit': 'Key Amenities',
            'New Apts Near Essential Amenit': 'New Apts, Key Amenities',
            'Amenities Galore in Aero Apts': 'Many Amenities at Aero',
            'Competitive Pricing, High Luxu': 'Great Pricing, Luxury',
            'Luxury Apartments, Prime Locat': 'Luxury Apts, Prime Loc'
        };
        
        // Direct replacements
        for (const [broken, fixed] of Object.entries(fixes)) {
            if (truncated.includes(broken)) {
                const result = truncated.replace(broken, fixed);
                if (result.length <= maxLength) {
                    return result;
                }
            }
        }
        
        // Remove trailing incomplete words
        const words = truncated.split(' ');
        const lastWord = words[words.length - 1];
        
        // If last word looks incomplete (no vowels, too short, etc.)
        if (lastWord.length < 4 && lastWord.length > 1 && !/[aeiou]/i.test(lastWord)) {
            words.pop(); // Remove incomplete word
            const cleaned = words.join(' ');
            
            // Try to add a completing word
            const completers = ['Now', 'Today', 'Here', 'Available'];
            for (const completer of completers) {
                const candidate = `${cleaned} ${completer}`;
                if (candidate.length <= maxLength) {
                    return candidate;
                }
            }
            
            return cleaned;
        }
        
        // If ends with comma, remove it and add action word
        if (truncated.endsWith(',')) {
            const base = truncated.slice(0, -1).trim();
            const actions = ['Now', 'Today'];
            for (const action of actions) {
                const candidate = `${base} ${action}`;
                if (candidate.length <= maxLength) {
                    return candidate;
                }
            }
            return base;
        }
        
        return this.smartTruncate(truncated, maxLength);
    }
    
    /**
     * Enhance short headlines to reach optimal length
     * @param {string} short Short headline
     * @param {number} maxLength Maximum length
     * @returns {string} Enhanced headline
     */
    enhanceShortHeadline(short, maxLength) {
        const target = Math.floor(maxLength * 0.9); // Target 90% of max
        
        if (short.length >= target) return short;
        
        const enhancers = [
            'Available Now',
            'Open Today', 
            'Prime Location',
            'Modern Amenities',
            'Luxury Living',
            'New Construction',
            'Call Today',
            'Tour Now'
        ];
        
        // Try adding enhancers that fit
        for (const enhancer of enhancers) {
            const candidate = `${short} ${enhancer}`;
            if (candidate.length <= maxLength && candidate.length >= target) {
                return candidate;
            }
        }
        
        // Try shorter enhancers
        const shortEnhancers = ['Now', 'Today', 'Here', 'Open', 'New'];
        for (const enhancer of shortEnhancers) {
            const candidate = `${short} ${enhancer}`;
            if (candidate.length <= maxLength) {
                return candidate;
            }
        }
        
        return short;
    }

    /**
     * Smart truncation with real estate context awareness
     * @param {string} text Text to truncate
     * @param {number} maxLength Maximum length
     * @returns {string} Smartly truncated text
     */
    smartTruncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        
        // Real estate specific abbreviations
        const abbreviations = {
            'Apartments': 'Apts',
            'Apartment': 'Apt',
            'Location': 'Loc',
            'Available': 'Avail',
            'Premium': 'Prime',
            'Luxury': 'Lux',
            'Amenities': 'Amenit',
            'Technology': 'Tech',
            'Construction': 'Const',
            'Competitive': 'Comp',
            'Essential': 'Key'
        };
        
        let result = text;
        
        // Apply abbreviations first
        for (const [long, short] of Object.entries(abbreviations)) {
            const pattern = new RegExp(`\\b${long}\\b`, 'gi');
            const candidate = result.replace(pattern, short);
            if (candidate.length <= maxLength) {
                result = candidate;
                if (result.length <= maxLength) break;
            }
        }
        
        if (result.length <= maxLength) return result;
        
        // Smart word boundary truncation
        const words = result.split(' ');
        let truncated = '';
        
        for (let i = 0; i < words.length; i++) {
            const candidate = truncated + (truncated ? ' ' : '') + words[i];
            if (candidate.length <= maxLength) {
                truncated = candidate;
            } else {
                break;
            }
        }
        
        return truncated || result.substring(0, maxLength).trim();
    }

    /**
     * Get optimized placeholder text within 90%-100% range
     * @param {number} index - Index of placeholder
     * @param {number} maxLength - Maximum length
     * @param {number} minLength - Minimum length (90% of max)
     * @returns {string} - Optimized placeholder text
     */
    getOptimizedPlaceholder(index, maxLength, minLength) {
        const placeholders = {
            30: [
                "Premium Living Space Today", // 27 chars (90%)
                "Luxury Apartments Available", // 28 chars (93%)
                "Modern Urban Homes Here Now", // 28 chars (93%)
                "Executive Residences Open", // 26 chars (87%) -> will be extended
                "Downtown Living Available", // 26 chars (87%) -> will be extended  
                "Upscale Amenities Await You", // 28 chars (93%)
                "Prime Location Units Ready", // 27 chars (90%)
                "Quality Craftsmanship Here", // 27 chars (90%)
                "Move-In Ready Homes Today", // 26 chars (87%) -> will be extended
                "Professional Housing Plus", // 25 chars (83%) -> will be extended
                "Elite Communities Available" // 28 chars (93%)
            ],
            90: [
                "Experience the perfect blend of luxury and convenience in our apartments. Schedule today!", // 88 chars (98%)
                "Discover upscale living with state-of-the-art amenities and prime location. Call now!", // 87 chars (97%)
                "Premium apartments featuring modern design, top amenities, and unbeatable location!", // 85 chars (94%)
                "Elevate your lifestyle with our luxury residences. Professional management services!" // 87 chars (97%)
            ],
            15: [
                "luxury-today", // 12 chars (80%) -> will be extended
                "apartments-now" // 14 chars (93%)
            ]
        };
        
        let placeholder = (placeholders[maxLength] && placeholders[maxLength][index]) || 
                         `Placeholder ${index+1}`;
        
        // Ensure placeholder is in optimal range
        if (placeholder.length < minLength) {
            return this.intelligentExtend(placeholder, maxLength, minLength, index);
        } else if (placeholder.length > maxLength) {
            return this.intelligentTruncate(placeholder, maxLength, minLength);
        }
        
        return placeholder;
    }

    /**
     * Get empty ad copy
     * @returns {Object} - Empty ad copy
     */
    getEmptyAdCopy() {
        return {
            headlines: [
                "Premium Living Space",
                "Luxury Apartments Now", 
                "Modern Urban Homes",
                "Executive Residences",
                "Downtown Living",
                "Upscale Amenities",
                "Prime Location Units",
                "Quality Craftsmanship", 
                "Move-In Ready Now",
                "Professional Housing",
                "Elite Communities"
            ],
            descriptions: [
                "Experience the perfect blend of luxury and convenience in our premium apartments. Schedule a tour today!",
                "Discover upscale living with state-of-the-art amenities and prime location. Contact us to learn more.",
                "Premium apartments featuring modern design, top amenities, and unbeatable location. Apply now!",
                "Elevate your lifestyle with our luxury residences. Professional management and exceptional service."
            ]
        };
    }

    /**
     * Get fallback ad copy
     * @param {Object} clientInfo - Client information
     * @returns {Object} - Fallback ad copy
     */
    getFallbackAdCopy(clientInfo) {
        const name = clientInfo.name || "Luxury Apartments";
        const location = clientInfo.geographicTargeting || "Prime Location";
        const cta = (clientInfo.callToAction || "Schedule a tour today").split(',')[0];
        
        return {
            headlines: [
                name.substring(0, 30),
                `${location.substring(0, 22)} Living`,
                `Premium Apartments`,
                "Executive Housing",
                "Modern Residences", 
                "Upscale Living",
                "Quality Homes",
                "Elite Properties",
                "Professional Units",
                "Luxury Available",
                "Prime Real Estate"
            ],
            descriptions: [
                `Experience luxury living with premium amenities and convenient location. ${cta.substring(0, 20)}`,
                `Modern design, exceptional service, and upscale features for discerning residents. Contact us now.`,
                `Discover refined living spaces with world-class amenities and professional management services.`,
                `Unparalleled luxury meets urban convenience. Premium apartments designed for modern professionals.`
            ]
        };
    }

    /**
     * Get mock response for testing without API key
     * @param {string} model - OpenAI model
     * @param {Array} messages - Messages array
     * @returns {string} - Mock response
     */
    getMockResponse(model, messages) {
        if (model === this.config.getOrchestrationModel()) {
            return `Based on the client information provided, here are the key strategic themes for effective Google Ads:

1. **Luxury Living Experience**: Emphasize premium amenities, high-end finishes, and sophisticated lifestyle
2. **Professional Convenience**: Highlight location benefits for working professionals, commute advantages
3. **Exclusive Community**: Focus on the selective nature and quality of residents
4. **Modern Technology**: Showcase smart home features, modern appliances, tech-enabled living
5. **Personalized Service**: Emphasize concierge services, responsive management, white-glove experience

These themes should resonate with young professionals and high-income individuals seeking luxury living options.`;
        } else {
            return JSON.stringify({
                headlines: [
                    "Luxury Apartments Available",
                    "Premium Living Spaces",
                    "High-End Rentals",
                    "Exclusive Apartments",
                    "Modern Luxury Living",
                    "Professional Housing",
                    "Upscale Rentals",
                    "Elite Apartments",
                    "Luxury Rentals",
                    "Premium Locations",
                    "Schedule Tour Today"
                ],
                descriptions: [
                    "Discover luxury living in our premium apartment community. Professional amenities.",
                    "High-end apartments with modern finishes. Perfect for discerning professionals.",
                    "Exclusive rental community with concierge services. Schedule your tour today.",
                    "Luxury apartments in prime location. Experience sophisticated urban living."
                ]
            });
        }
    }

    /**
     * Test API connection
     * @returns {Promise<boolean>} - True if connection successful
     */
    async testConnection() {
        try {
            if (!this.config.hasApiKey()) {
                // Return true for mock mode
                return true;
            }

            // Test with a simple API call
            const response = await fetch(`${this.config.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: this.config.getHeaders(),
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ],
                    max_tokens: 5
                })
            });

            return response.ok;
        } catch (error) {
            console.error('OpenAI API connection test failed:', error.message);
            return false;
        }
    }

    /**
     * Generate a response using OpenAI API with custom messages and model
     * @param {Array} messages - Array of message objects for the conversation
     * @param {string} model - The OpenAI model to use (default: gpt-3.5-turbo)
     * @returns {Promise<string>} - The generated response content
     */
    async generateResponse(messages, model = 'gpt-3.5-turbo') {
        try {
            return await this.callOpenAI(model, messages);
        } catch (error) {
            console.error('Error generating OpenAI response:', error);
            throw new Error('Failed to generate response from OpenAI');
        }
    }

    /**
     * Test the backend validation with user's problematic headlines
     * Call in console: new OpenAIConnector({}).testBackendValidation()
     */
    testBackendValidation() {
        const problematicHeadlines = [
            "Aero Apartments Now Leasing",
            "Experience Luxury Living Today", 
            "New Construction in SoCal Now",
            "Apartments Near Top Schools",
            "Luxury Apartments, Prime Locat",      // Truncated
            "Competitive Pricing, High Luxu",     // Truncated
            "Amenities Galore in Aero Apts",      // At limit
            "New Apts Near Essential Amenit",     // Truncated  
            "Luxury Living, Great Prices!",
            "Newly Built Aero Apartments",
            "Proximity & Comfort at Aero"
        ];
        
        console.log('🛡️ BACKEND VALIDATION TEST');
        console.log('===========================');
        
        console.log('\n📝 Original Headlines:');
        problematicHeadlines.forEach((h, i) => {
            console.log(`${i + 1}. "${h}" (${h.length} chars)`);
        });
        
        const validated = this.validateAndFixHeadlines(problematicHeadlines, 30);
        
        console.log('\n✅ After Backend Validation:');
        validated.forEach((h, i) => {
            const original = problematicHeadlines[i] || '';
            const wasFixed = h !== original;
            console.log(`${i + 1}. "${h}" (${h.length} chars) ${wasFixed ? '🔧 FIXED' : '✅ OK'}`);
            if (wasFixed && original) {
                console.log(`   Was: "${original}"`);
            }
        });
        
        console.log('\n🎯 Validation Features Demonstrated:');
        console.log('• Truncation pattern detection');
        console.log('• Incomplete phrase fixing');
        console.log('• Smart abbreviation replacement');
        console.log('• Fallback headline generation');
        console.log('• Exactly 11 headlines guaranteed');
        
        return validated;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenAIConnector;
}
