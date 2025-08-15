/**
 * Database Client
 * Handles all database operations for the frontend
 */

class DatabaseClient {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.currentClientId = null;
        this.currentClient = null;
        this.isSupabaseEnabled = false;
        this.initializeSupabaseStatus();
    }

    async initializeSupabaseStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const health = await response.json();
            this.isSupabaseEnabled = response.ok && !health.configuration?.supabase;
            
            // Try to load current client if we have a stored ID
            const storedClientId = localStorage.getItem('supabase_client_id');
            if (storedClientId && this.isSupabaseEnabled) {
                await this.getCurrentClient();
            }
        } catch (error) {
            console.log('Supabase not available, using localStorage mode');
            this.isSupabaseEnabled = false;
        }
    }

    // Client Management Functions
    async getAllClients() {
        if (!this.isSupabaseEnabled) {
            throw new Error('Supabase not configured');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clients`);
            if (!response.ok) {
                throw new Error('Failed to fetch clients');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error fetching clients:', error);
            throw error;
        }
    }

    async createClient(clientData) {
        if (!this.isSupabaseEnabled) {
            throw new Error('Supabase not configured');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: clientData.clientName || clientData.name,
                    website_url: clientData.websiteUrl,
                    industry: clientData.industry,
                    target_audience: clientData.targetAudience,
                    geographic_targeting: clientData.geographicTargeting,
                    unique_selling_points: clientData.uniqueSellingPoints,
                    competitors: clientData.competitors,
                    brand_voice: clientData.brandVoice,
                    call_to_action: clientData.callToAction,
                    budget: clientData.budget ? parseFloat(clientData.budget) : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create client');
            }

            const result = await response.json();
            this.currentClientId = result.data.id;
            this.currentClient = result.data;
            
            // Save client ID to localStorage for future use
            localStorage.setItem('supabase_client_id', this.currentClientId);
            
            return result.data;
        } catch (error) {
            console.error('Error creating client:', error);
            throw error;
        }
    }

    async setCurrentClient(clientId) {
        this.currentClientId = clientId;
        localStorage.setItem('supabase_client_id', clientId);
        
        try {
            const client = await this.getCurrentClient();
            return client;
        } catch (error) {
            console.error('Error setting current client:', error);
            throw error;
        }
    }

    async getCampaignsByClient(clientId = null) {
        const targetClientId = clientId || this.currentClientId;
        if (!targetClientId) {
            throw new Error('No client ID provided');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clients/${targetClientId}/campaigns`);
            if (!response.ok) {
                throw new Error('Failed to fetch campaigns');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error fetching campaigns for client:', error);
            throw error;
        }
    }

    // Save functions for direct database operations
    async saveClientInfo(clientInfo) {
        if (!this.isSupabaseEnabled) {
            // Fall back to localStorage
            localStorage.setItem('clientInfo', JSON.stringify(clientInfo));
            return { success: true, mode: 'localStorage' };
        }

        try {
            if (this.currentClientId) {
                // Update existing client
                const updatedClient = await this.updateClientInfo(clientInfo);
                return { success: true, data: updatedClient, mode: 'supabase', action: 'updated' };
            } else {
                // Create new client
                const newClient = await this.createClient(clientInfo);
                return { success: true, data: newClient, mode: 'supabase', action: 'created' };
            }
        } catch (error) {
            console.error('Error saving client info:', error);
            // Fall back to localStorage on error
            localStorage.setItem('clientInfo', JSON.stringify(clientInfo));
            return { success: false, error: error.message, mode: 'localStorage' };
        }
    }

    async saveCampaign(campaignData) {
        if (!this.isSupabaseEnabled || !this.currentClientId) {
            throw new Error('Supabase not configured or no client selected');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/campaigns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this.currentClientId,
                    name: campaignData.name,
                    objective: campaignData.objective || '',
                    budget: campaignData.budget ? parseFloat(campaignData.budget) : null,
                    is_unit_type: campaignData.isUnitType || false
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save campaign');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error saving campaign:', error);
            throw error;
        }
    }

    // Migration operations
    async migrateLocalStorageData() {
        try {
            // Get existing localStorage data
            const clientInfo = this.getLocalStorageClientInfo();
            const campaignsData = this.getLocalStorageCampaignsData();
            
            if (!clientInfo || !campaignsData || Object.keys(campaignsData).length === 0) {
                throw new Error('No local data found to migrate');
            }

            const response = await fetch(`${this.apiBaseUrl}/api/migrate-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clientInfo,
                    campaignsData
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Migration failed');
            }

            const result = await response.json();
            
            // Store the new client ID
            this.currentClientId = result.data.client.id;
            this.currentClient = result.data.client;
            
            // Save client ID to localStorage for future use
            localStorage.setItem('supabase_client_id', this.currentClientId);
            
            return result.data;
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    }

    // Client operations
    async getCurrentClient() {
        if (!this.currentClientId) {
            this.currentClientId = localStorage.getItem('supabase_client_id');
        }

        if (!this.currentClientId) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clients/${this.currentClientId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch client');
            }

            const result = await response.json();
            this.currentClient = result.data;
            return result.data;
        } catch (error) {
            console.error('Error fetching client:', error);
            return null;
        }
    }

    async updateClientInfo(clientInfo) {
        if (!this.currentClientId) {
            throw new Error('No client ID available');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/clients/${this.currentClientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: clientInfo.clientName || clientInfo.name,
                    website_url: clientInfo.websiteUrl,
                    industry: clientInfo.industry,
                    target_audience: clientInfo.targetAudience,
                    geographic_targeting: clientInfo.geographicTargeting,
                    unique_selling_points: clientInfo.uniqueSellingPoints,
                    competitors: clientInfo.competitors,
                    brand_voice: clientInfo.brandVoice,
                    call_to_action: clientInfo.callToAction,
                    budget: clientInfo.budget ? parseFloat(clientInfo.budget) : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update client');
            }

            const result = await response.json();
            this.currentClient = result.data;
            return result.data;
        } catch (error) {
            console.error('Error updating client:', error);
            throw error;
        }
    }

    // Campaign operations
    async createCampaign(campaignData) {
        if (!this.currentClientId) {
            throw new Error('No client ID available');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/campaigns`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: this.currentClientId,
                    name: campaignData.name,
                    objective: campaignData.objective || '',
                    budget: campaignData.budget ? parseFloat(campaignData.budget) : null,
                    is_unit_type: campaignData.isUnitType || false
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create campaign');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    }

    async getCampaign(campaignId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/campaigns/${campaignId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch campaign');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error fetching campaign:', error);
            throw error;
        }
    }

    async updateCampaign(campaignId, updates) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error('Failed to update campaign');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error updating campaign:', error);
            throw error;
        }
    }

    async deleteCampaign(campaignId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/campaigns/${campaignId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete campaign');
            }

            return true;
        } catch (error) {
            console.error('Error deleting campaign:', error);
            throw error;
        }
    }

    // Ad Group operations
    async createAdGroup(adGroupData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ad-groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(adGroupData)
            });

            if (!response.ok) {
                throw new Error('Failed to create ad group');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error creating ad group:', error);
            throw error;
        }
    }

    // Keyword operations
    async saveKeywords(adGroupId, keywords) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/keywords`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    adGroupId,
                    keywords
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save keywords');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error saving keywords:', error);
            throw error;
        }
    }

    // Ad operations
    async createAd(adData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/ads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(adData)
            });

            if (!response.ok) {
                throw new Error('Failed to create ad');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error creating ad:', error);
            throw error;
        }
    }

    // Data conversion helpers
    convertSupabaseToLocalFormat(supabaseClient) {
        const clientInfo = {
            clientName: supabaseClient.name,
            websiteUrl: supabaseClient.website_url || '',
            industry: supabaseClient.industry || '',
            targetAudience: supabaseClient.target_audience || '',
            geographicTargeting: supabaseClient.geographic_targeting || '',
            uniqueSellingPoints: supabaseClient.unique_selling_points || '',
            competitors: supabaseClient.competitors || '',
            brandVoice: supabaseClient.brand_voice || '',
            callToAction: supabaseClient.call_to_action || '',
            budget: supabaseClient.budget ? supabaseClient.budget.toString() : ''
        };

        const campaignsData = {};

        if (supabaseClient.campaigns) {
            supabaseClient.campaigns.forEach(campaign => {
                const campaignId = campaign.id;
                campaignsData[campaignId] = {
                    name: campaign.name,
                    objective: campaign.objective || '',
                    budget: campaign.budget ? campaign.budget.toString() : '',
                    isUnitType: campaign.is_unit_type || false,
                    adGroups: {},
                    keywords: {},
                    ads: {}
                };

                if (campaign.ad_groups) {
                    campaign.ad_groups.forEach(adGroup => {
                        const adGroupId = adGroup.id;
                        campaignsData[campaignId].adGroups[adGroupId] = {
                            name: adGroup.name,
                            theme: adGroup.theme || '',
                            targetAudience: adGroup.target_audience || '',
                            isLocationAdGroup: adGroup.is_location_ad_group || false
                        };

                        // Convert keywords
                        if (adGroup.keywords) {
                            campaignsData[campaignId].keywords[adGroupId] = adGroup.keywords.map(kw => ({
                                text: kw.text,
                                matchType: kw.match_type,
                                searchVolume: kw.search_volume || 0,
                                cpc: kw.cpc || 0,
                                competition: kw.competition || 0
                            }));
                        }

                        // Convert ads
                        if (adGroup.ads) {
                            campaignsData[campaignId].ads[adGroupId] = adGroup.ads.map(ad => ({
                                headline1: ad.headline_1 || '',
                                headline2: ad.headline_2 || '',
                                headline3: ad.headline_3 || '',
                                headline4: ad.headline_4 || '',
                                headline5: ad.headline_5 || '',
                                headline6: ad.headline_6 || '',
                                headline7: ad.headline_7 || '',
                                headline8: ad.headline_8 || '',
                                headline9: ad.headline_9 || '',
                                headline10: ad.headline_10 || '',
                                headline11: ad.headline_11 || '',
                                description1: ad.description_1 || '',
                                description2: ad.description_2 || '',
                                description3: ad.description_3 || '',
                                description4: ad.description_4 || ''
                            }));
                        }
                    });
                }
            });
        }

        return { clientInfo, campaignsData };
    }

    // LocalStorage helpers
    getLocalStorageClientInfo() {
        const saved = localStorage.getItem('clientInfo');
        return saved ? JSON.parse(saved) : null;
    }

    getLocalStorageCampaignsData() {
        const saved = localStorage.getItem('campaignsData');
        return saved ? JSON.parse(saved) : {};
    }

    hasLocalStorageData() {
        const clientInfo = this.getLocalStorageClientInfo();
        const campaignsData = this.getLocalStorageCampaignsData();
        return !!(clientInfo && campaignsData && Object.keys(campaignsData).length > 0);
    }

    isUsingSupabase() {
        return this.isSupabaseEnabled && this.currentClientId;
    }

    clearCurrentClient() {
        this.currentClientId = null;
        this.currentClient = null;
        localStorage.removeItem('supabase_client_id');
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DatabaseClient;
} 