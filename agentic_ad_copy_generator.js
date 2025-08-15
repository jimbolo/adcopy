/**
 * Agentic Ad Copy Generator
 * This module integrates with the backend API to generate ad copy based on user inputs
 */

class AgenticAdCopyGenerator {
    constructor() {
        this.isGenerating = false;
        this.apiBaseUrl = window.location.origin; // Use the same origin as the current page
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for the UI
     */
    setupEventListeners() {
        // Add event listener for generate button
        const generateButton = document.getElementById('generate-ad-copy');
        if (generateButton) {
            generateButton.addEventListener('click', () => {
                this.generateAdCopy();
            });
        }
    }

    /**
     * Collect client information from the form
     * @returns {Object} - Client information
     */
    collectClientInfo() {
        return {
            name: document.getElementById('client-name').value,
            website: document.getElementById('website-url').value,
            industry: document.getElementById('industry').value,
            targetAudience: document.getElementById('target-audience').value,
            geographicTargeting: document.getElementById('geographic-targeting').value,
            uniqueSellingPoints: document.getElementById('unique-selling-points').value,
            competitors: document.getElementById('competitors').value,
            brandVoice: document.getElementById('brand-voice').value,
            callToAction: document.getElementById('call-to-action').value,
            budget: document.getElementById('budget').value
        };
    }

    /**
     * Generate ad copy using backend API
     */
    async generateAdCopy() {
        if (this.isGenerating) {
            return;
        }

        console.log('=== AD COPY GENERATION START ===');

        // Get selected campaign and ad group
        const campaignSelect = document.getElementById('ad-campaign-select');
        const adGroupSelect = document.getElementById('ad-group-select');
        
        console.log('Campaign select element:', campaignSelect);
        console.log('Ad group select element:', adGroupSelect);
        
        if (!campaignSelect || !adGroupSelect) {
            this.showError('Please select a campaign and ad group first.');
            return;
        }

        const campaignId = campaignSelect.value;
        const adGroupId = adGroupSelect.value;
        
        console.log('Selected campaign ID:', campaignId);
        console.log('Selected ad group ID:', adGroupId);
        console.log('window.campaignsData exists:', !!window.campaignsData);
        console.log('window.campaignsData content:', window.campaignsData);
        
        if (!campaignId || !adGroupId) {
            this.showError('Please select a campaign and ad group first.');
            return;
        }

        // Collect client information
        const clientInfo = this.collectClientInfo();
        
        // Get campaign and ad group context from the global campaignsData
        let campaignContext = null;
        let adGroupContext = null;
        let savedKeywords = null;
        
        console.log('Checking if campaign exists in campaignsData...');
        if (window.campaignsData && window.campaignsData[campaignId]) {
            console.log('✓ Campaign found in campaignsData');
            campaignContext = {
                id: campaignId,
                name: window.campaignsData[campaignId].name,
                objective: window.campaignsData[campaignId].objective || '',
                budget: window.campaignsData[campaignId].budget || '',
                isUnitType: window.campaignsData[campaignId].isUnitType || false
            };
            
            // Debug logging for unit type detection
            console.log('Campaign data for', campaignId, ':', window.campaignsData[campaignId]);
            console.log('Campaign context created:', campaignContext);
            console.log('Is unit type campaign?', campaignContext.isUnitType);
            
            if (adGroupId && window.campaignsData[campaignId].adGroups && window.campaignsData[campaignId].adGroups[adGroupId]) {
                console.log('✓ Ad group found in campaignsData');
                const adGroup = window.campaignsData[campaignId].adGroups[adGroupId];
                
                // Create theme from client info if not set at ad group level
                let theme = adGroup.theme || '';
                if (!theme) {
                    const themeParts = [];
                    if (clientInfo.uniqueSellingPoints) themeParts.push(clientInfo.uniqueSellingPoints);
                    if (clientInfo.brandVoice) themeParts.push(clientInfo.brandVoice);
                    if (clientInfo.industry) themeParts.push(clientInfo.industry);
                    if (adGroup.name) themeParts.push(`focused on ${adGroup.name}`);
                    theme = themeParts.join(', ');
                }
                
                adGroupContext = {
                    id: adGroupId,
                    name: adGroup.name,
                    theme: theme,
                    targetAudience: adGroup.targetAudience || clientInfo.targetAudience || ''
                };
            } else {
                console.log('✗ Ad group not found. Available ad groups:', window.campaignsData[campaignId].adGroups);
            }
            
            // Get saved keywords for all campaign types
            if (window.campaignsData[campaignId].keywords && 
                window.campaignsData[campaignId].keywords[adGroupId]) {
                savedKeywords = window.campaignsData[campaignId].keywords[adGroupId];
                console.log('Using saved keywords for ad copy generation:', savedKeywords);
            } else {
                console.log('No saved keywords found for adGroupId:', adGroupId);
                console.log('Available keyword data:', window.campaignsData[campaignId].keywords);
            }
        } else {
            console.log('✗ Campaign not found in campaignsData');
            console.log('Available campaigns:', Object.keys(window.campaignsData || {}));
        }

        // For unit type campaigns, we don't need to validate all client info - just need basic context
        if (!campaignContext || !campaignContext.isUnitType) {
            // Validate required fields for non-unit type campaigns
            if (!this.validateClientInfo(clientInfo)) {
                this.showError('Please fill in all required client information fields.');
                return;
            }
        }

        try {
            this.isGenerating = true;
            this.showGeneratingStatus(true);

            // Prepare the request payload
            const requestPayload = { 
                clientInfo: (campaignContext && campaignContext.isUnitType) ? {} : clientInfo, // Empty client info for unit type
                campaignContext,
                adGroupContext
            };
            
            // Debug logging for payload preparation
            console.log('Preparing request payload...');
            console.log('Original clientInfo:', clientInfo);
            console.log('Is unit type?', campaignContext && campaignContext.isUnitType);
            console.log('Final clientInfo in payload:', requestPayload.clientInfo);
            console.log('Campaign context in payload:', requestPayload.campaignContext);
            
            // Add saved keywords for all campaign types
            if (savedKeywords) {
                requestPayload.savedKeywords = savedKeywords;
                console.log('Added saved keywords to payload:', savedKeywords);
            }
            
            console.log('Final request payload:', requestPayload);

            // Make API call to backend with campaign and ad group context
            const response = await fetch(`${this.apiBaseUrl}/api/generate-ad-copy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate ad copy');
            }

            const result = await response.json();
            
            // Update UI with generated ad copy
            this.updateAdCopyUI(result.data.adCopy);
            
            // Show success message
            this.showSuccess('Ad copy generated successfully!');
        } catch (error) {
            console.error('Error generating ad copy:', error);
            this.showError(`Failed to generate ad copy: ${error.message}`);
        } finally {
            this.isGenerating = false;
            this.showGeneratingStatus(false);
        }
    }

    /**
     * Validate client information
     * @param {Object} clientInfo - Client information
     * @returns {boolean} - Whether client information is valid
     */
    validateClientInfo(clientInfo) {
        const requiredFields = [
            'name', 'website', 'industry', 'targetAudience', 
            'geographicTargeting', 'uniqueSellingPoints', 'brandVoice', 'callToAction'
        ];
        
        for (const field of requiredFields) {
            if (!clientInfo[field] || clientInfo[field].trim() === '') {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Update UI with generated ad copy
     * @param {Object} adCopy - Generated ad copy
     */
    updateAdCopyUI(adCopy) {
        // Debug logging to see what we received
        console.log('Received ad copy data:', adCopy);
        console.log('Headlines:', adCopy.headlines);
        console.log('Descriptions:', adCopy.descriptions);
        
        // Update headlines - Updated to handle 11 headlines
        const headlineIds = ['headline1', 'headline2', 'headline3', 'headline4', 'headline5', 'headline6', 'headline7', 'headline8', 'headline9', 'headline10', 'headline11'];
        for (let i = 0; i < adCopy.headlines.length && i < headlineIds.length; i++) {
            const headlineInput = document.getElementById(headlineIds[i]);
            if (headlineInput) {
                console.log(`Setting headline ${i + 1}:`, adCopy.headlines[i]);
                headlineInput.value = adCopy.headlines[i];
                // Trigger input event to update character count
                const event = new Event('input', { bubbles: true });
                headlineInput.dispatchEvent(event);
            } else {
                console.warn(`Could not find headline input: ${headlineIds[i]}`);
            }
        }
        
        // Update descriptions - Updated to handle 4 descriptions
        const descriptionIds = ['description1', 'description2', 'description3', 'description4'];
        for (let i = 0; i < adCopy.descriptions.length && i < descriptionIds.length; i++) {
            const descriptionInput = document.getElementById(descriptionIds[i]);
            if (descriptionInput) {
                console.log(`Setting description ${i + 1}:`, adCopy.descriptions[i]);
                descriptionInput.value = adCopy.descriptions[i];
                // Trigger input event to update character count
                const event = new Event('input', { bubbles: true });
                descriptionInput.dispatchEvent(event);
            } else {
                console.warn(`Could not find description input: ${descriptionIds[i]}`);
            }
        }
        
        // Update the preview
        this.updateAdPreview();
    }

    /**
     * Update ad preview
     */
    updateAdPreview() {
        const headline1 = document.getElementById('headline1').value;
        const headline2 = document.getElementById('headline2').value;
        const headline3 = document.getElementById('headline3').value;
        const headline4 = document.getElementById('headline4').value;
        const headline5 = document.getElementById('headline5').value;
        const headline6 = document.getElementById('headline6').value;
        const headline7 = document.getElementById('headline7').value;
        const headline8 = document.getElementById('headline8').value;
        const headline9 = document.getElementById('headline9').value;
        const headline10 = document.getElementById('headline10').value;
        const headline11 = document.getElementById('headline11').value;
        const description1 = document.getElementById('description1').value;
        const description2 = document.getElementById('description2').value;
        const description3 = document.getElementById('description3').value;
        const description4 = document.getElementById('description4').value;
        const websiteUrl = document.getElementById('website-url').value;

        const previewContainer = document.getElementById('ad-preview');
        if (previewContainer) {
            const domain = this.extractDomain(websiteUrl);
            
            // Count total available headlines and descriptions
            const availableHeadlines = [headline1, headline2, headline3, headline4, headline5, headline6, headline7, headline8, headline9, headline10, headline11].filter(h => h && h.trim()).length;
            const availableDescriptions = [description1, description2, description3, description4].filter(d => d && d.trim()).length;
            
            previewContainer.innerHTML = `
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px; background-color: #fff;">
                    <div style="color: #1a73e8; font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                        ${headline1 || 'Headline 1'} | ${headline2 || 'Headline 2'} | ${headline3 || 'Headline 3'}
                    </div>
                    <div style="color: #006621; font-size: 14px; margin-bottom: 5px;">
                        ${domain}
                    </div>
                    <div style="color: #545454; font-size: 14px; line-height: 1.4;">
                        ${description1 || 'Description 1'} ${description2 || 'Description 2'}
                    </div>
                    <div style="color: #999; font-size: 12px; margin-top: 10px; font-style: italic;">
                        Total available: ${availableHeadlines} headlines, ${availableDescriptions} descriptions
                    </div>
                </div>
            `;
        }
    }

    /**
     * Extract domain from URL
     * @param {string} url - Full URL
     * @returns {string} - Domain
     */
    extractDomain(url) {
        try {
            if (!url) return 'www.example.com';
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return 'www.example.com';
        }
    }

    /**
     * Show generating status
     * @param {boolean} isGenerating - Whether currently generating
     */
    showGeneratingStatus(isGenerating) {
        const loadingElement = document.getElementById('loading-ad-copy');
        const generateButton = document.getElementById('generate-ad-copy');
        
        if (loadingElement) {
            loadingElement.style.display = isGenerating ? 'block' : 'none';
        }
        
        if (generateButton) {
            generateButton.disabled = isGenerating;
            generateButton.textContent = isGenerating ? 'Generating...' : 'Generate Ad Copy';
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        // Remove any existing error messages
        this.clearMessages();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.display = 'block';
        errorDiv.textContent = message;
        
        const generateButton = document.getElementById('generate-ad-copy');
        if (generateButton && generateButton.parentNode) {
            generateButton.parentNode.insertBefore(errorDiv, generateButton);
        }
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        // Remove any existing messages
        this.clearMessages();
        
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.textContent = message;
        
        const generateButton = document.getElementById('generate-ad-copy');
        if (generateButton && generateButton.parentNode) {
            generateButton.parentNode.insertBefore(successDiv, generateButton);
        }
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    /**
     * Clear all messages
     */
    clearMessages() {
        const messages = document.querySelectorAll('.error-message, .success');
        messages.forEach(message => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        });
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgenticAdCopyGenerator;
}
