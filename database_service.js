const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    // Client operations
    async createClient(clientData) {
        const { data, error } = await this.supabase
            .from('clients')
            .insert([clientData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async getClient(clientId) {
        const { data, error } = await this.supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();
        
        if (error) throw error;
        return data;
    }

    async updateClient(clientId, updates) {
        const { data, error } = await this.supabase
            .from('clients')
            .update(updates)
            .eq('id', clientId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async deleteClient(clientId) {
        const { error } = await this.supabase
            .from('clients')
            .delete()
            .eq('id', clientId);
        
        if (error) throw error;
        return true;
    }

    // Campaign operations
    async createCampaign(campaignData) {
        const { data, error } = await this.supabase
            .from('campaigns')
            .insert([campaignData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async getCampaign(campaignId) {
        const { data, error } = await this.supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();
        
        if (error) throw error;
        return data;
    }

    async getCampaignsByClient(clientId) {
        const { data, error } = await this.supabase
            .from('campaigns')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    async updateCampaign(campaignId, updates) {
        const { data, error } = await this.supabase
            .from('campaigns')
            .update(updates)
            .eq('id', campaignId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async deleteCampaign(campaignId) {
        const { error } = await this.supabase
            .from('campaigns')
            .delete()
            .eq('id', campaignId);
        
        if (error) throw error;
        return true;
    }

    // Ad Group operations
    async createAdGroup(adGroupData) {
        const { data, error } = await this.supabase
            .from('ad_groups')
            .insert([adGroupData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async getAdGroup(adGroupId) {
        const { data, error } = await this.supabase
            .from('ad_groups')
            .select('*')
            .eq('id', adGroupId)
            .single();
        
        if (error) throw error;
        return data;
    }

    async getAdGroupsByCampaign(campaignId) {
        const { data, error } = await this.supabase
            .from('ad_groups')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    async updateAdGroup(adGroupId, updates) {
        const { data, error } = await this.supabase
            .from('ad_groups')
            .update(updates)
            .eq('id', adGroupId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async deleteAdGroup(adGroupId) {
        const { error } = await this.supabase
            .from('ad_groups')
            .delete()
            .eq('id', adGroupId);
        
        if (error) throw error;
        return true;
    }

    // Keyword operations
    async createKeywords(keywordDataArray) {
        const { data, error } = await this.supabase
            .from('keywords')
            .insert(keywordDataArray)
            .select();
        
        if (error) throw error;
        return data;
    }

    async getKeywordsByAdGroup(adGroupId) {
        const { data, error } = await this.supabase
            .from('keywords')
            .select('*')
            .eq('ad_group_id', adGroupId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    async deleteKeywordsByAdGroup(adGroupId) {
        const { error } = await this.supabase
            .from('keywords')
            .delete()
            .eq('ad_group_id', adGroupId);
        
        if (error) throw error;
        return true;
    }

    // Ad operations
    async createAd(adData) {
        const { data, error } = await this.supabase
            .from('ads')
            .insert([adData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async getAdsByAdGroup(adGroupId) {
        const { data, error } = await this.supabase
            .from('ads')
            .select('*')
            .eq('ad_group_id', adGroupId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    async updateAd(adId, updates) {
        const { data, error } = await this.supabase
            .from('ads')
            .update(updates)
            .eq('id', adId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    async deleteAd(adId) {
        const { error } = await this.supabase
            .from('ads')
            .delete()
            .eq('id', adId);
        
        if (error) throw error;
        return true;
    }

    // Complex operations
    async getCampaignWithFullStructure(campaignId) {
        // Get campaign with client
        const { data: campaign, error: campaignError } = await this.supabase
            .from('campaigns')
            .select(`
                *,
                clients (*)
            `)
            .eq('id', campaignId)
            .single();
        
        if (campaignError) throw campaignError;

        // Get ad groups with keywords and ads
        const { data: adGroups, error: adGroupsError } = await this.supabase
            .from('ad_groups')
            .select(`
                *,
                keywords (*),
                ads (*)
            `)
            .eq('campaign_id', campaignId);
        
        if (adGroupsError) throw adGroupsError;

        campaign.ad_groups = adGroups;
        return campaign;
    }

    async getClientWithAllCampaigns(clientId) {
        const { data: client, error: clientError } = await this.supabase
            .from('clients')
            .select(`
                *,
                campaigns (
                    *,
                    ad_groups (
                        *,
                        keywords (*),
                        ads (*)
                    )
                )
            `)
            .eq('id', clientId)
            .single();
        
        if (clientError) throw clientError;
        return client;
    }

    // Migration helpers
    async migrateLocalStorageData(clientInfo, campaignsData) {
        // Start a transaction-like approach
        try {
            // 1. Create or update client
            const client = await this.createClient({
                name: clientInfo.clientName || 'Migrated Client',
                website_url: clientInfo.websiteUrl,
                industry: clientInfo.industry,
                target_audience: clientInfo.targetAudience,
                geographic_targeting: clientInfo.geographicTargeting,
                unique_selling_points: clientInfo.uniqueSellingPoints,
                competitors: clientInfo.competitors,
                brand_voice: clientInfo.brandVoice,
                call_to_action: clientInfo.callToAction,
                budget: clientInfo.budget ? parseFloat(clientInfo.budget) : null
            });

            const migratedCampaigns = {};

            // 2. Create campaigns
            for (const [localCampaignId, localCampaign] of Object.entries(campaignsData)) {
                const campaign = await this.createCampaign({
                    client_id: client.id,
                    name: localCampaign.name,
                    objective: localCampaign.objective || '',
                    budget: localCampaign.budget ? parseFloat(localCampaign.budget) : null,
                    is_unit_type: localCampaign.isUnitType || false
                });

                migratedCampaigns[localCampaignId] = campaign;

                // 3. Create ad groups
                if (localCampaign.adGroups) {
                    for (const [localAdGroupId, localAdGroup] of Object.entries(localCampaign.adGroups)) {
                        const adGroup = await this.createAdGroup({
                            campaign_id: campaign.id,
                            name: localAdGroup.name,
                            theme: localAdGroup.theme || '',
                            target_audience: localAdGroup.targetAudience || '',
                            is_location_ad_group: localAdGroup.isLocationAdGroup || false
                        });

                        // 4. Create keywords
                        if (localCampaign.keywords && localCampaign.keywords[localAdGroupId]) {
                            const keywordData = localCampaign.keywords[localAdGroupId].map(kw => ({
                                ad_group_id: adGroup.id,
                                text: kw.text,
                                match_type: kw.matchType,
                                search_volume: kw.searchVolume || 0,
                                cpc: kw.cpc || 0,
                                competition: kw.competition || 0
                            }));
                            
                            if (keywordData.length > 0) {
                                await this.createKeywords(keywordData);
                            }
                        }

                        // 5. Create ads
                        if (localCampaign.ads && localCampaign.ads[localAdGroupId]) {
                            for (const localAd of localCampaign.ads[localAdGroupId]) {
                                await this.createAd({
                                    ad_group_id: adGroup.id,
                                    headline_1: localAd.headline1,
                                    headline_2: localAd.headline2,
                                    headline_3: localAd.headline3,
                                    headline_4: localAd.headline4,
                                    headline_5: localAd.headline5,
                                    headline_6: localAd.headline6,
                                    headline_7: localAd.headline7,
                                    headline_8: localAd.headline8,
                                    headline_9: localAd.headline9,
                                    headline_10: localAd.headline10,
                                    headline_11: localAd.headline11,
                                    description_1: localAd.description1,
                                    description_2: localAd.description2,
                                    description_3: localAd.description3,
                                    description_4: localAd.description4
                                });
                            }
                        }
                    }
                }
            }

            return { client, campaigns: migratedCampaigns };
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }
}

module.exports = DatabaseService; 