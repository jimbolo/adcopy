const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const OpenAIConfig = require('./openai_config');
const OpenAIConnector = require('./openai_connector');
const SemrushConnector = require('./semrush_connector');
const DatabaseService = require('./database_service');
const { handleError, AppError } = require('./error_handling');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Initialize services
let openaiConnector;
let semrushConnector;
let databaseService;

try {
    const config = new OpenAIConfig();
    openaiConnector = new OpenAIConnector(config);
    console.log('OpenAI connector initialized successfully');
    
    // Initialize Supabase database service
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        databaseService = new DatabaseService();
        console.log('Supabase database service initialized successfully');
    } else {
        console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not found in environment variables.');
        console.warn('Database operations will not be available.');
        console.warn('To enable database operations:');
        console.warn('1. Add SUPABASE_URL=your_supabase_url to your .env file');
        console.warn('2. Add SUPABASE_ANON_KEY=your_supabase_anon_key to your .env file');
        console.warn('3. Restart the server');
    }
    
    // Initialize Semrush connector if API key is provided
    if (process.env.SEMRUSH_API_KEY) {
        semrushConnector = new SemrushConnector(process.env.SEMRUSH_API_KEY, openaiConnector);
        console.log('Semrush connector initialized successfully');
    } else {
        console.warn('SEMRUSH_API_KEY not found in environment variables.');
        console.warn('Keyword generation will require Semrush API configuration.');
        console.warn('To enable keyword generation:');
        console.warn('1. Get your API key from https://www.semrush.com/api-documentation/');
        console.warn('2. Add SEMRUSH_API_KEY=your_key_here to your .env file');
        console.warn('3. Restart the server');
    }
    
    console.log('Services initialized successfully');
} catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                openai: await openaiConnector.testConnection(),
                semrush: {
                    configured: !!semrushConnector,
                    working: semrushConnector ? await semrushConnector.testConnection() : false
                }
            }
        };
        
        // Add configuration guidance if Semrush is not configured
        if (!semrushConnector) {
            health.configuration = {
                semrush: {
                    required: true,
                    message: "Semrush API key required for keyword generation",
                    instructions: [
                        "1. Get API key from https://www.semrush.com/api-documentation/",
                        "2. Add SEMRUSH_API_KEY=your_key_here to .env file",
                        "3. Restart server"
                    ]
                }
            };
        }
        
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API endpoint to generate ad copy
app.post('/api/generate-ad-copy', async (req, res) => {
    try {
        console.log('=== AD COPY GENERATION REQUEST ===');
        console.log('Full request body:', JSON.stringify(req.body, null, 2));
        console.log('Client info received:', req.body.clientInfo);
        console.log('Campaign context received:', req.body.campaignContext);
        console.log('Saved keywords received:', req.body.savedKeywords);
        console.log('Generating ad copy for client:', req.body.clientInfo?.name || 'Unknown');
        
        const { clientInfo, campaignContext, adGroupContext, savedKeywords } = req.body;
        
        let keywordData = null;
        
        // Check for saved keywords for ALL campaign types
        console.log('Checking for saved keywords:');
        console.log('- campaignContext exists:', !!campaignContext);
        console.log('- savedKeywords exists:', !!savedKeywords);
        console.log('- savedKeywords length:', savedKeywords?.length);
        
        if (savedKeywords && savedKeywords.length > 0) {
            console.log('✓ Using saved keywords for ad copy generation.');
            
            // Convert saved keywords to the expected keywordData format
            const formattedKeywords = savedKeywords.map(kw => ({
                keyword: kw.text,
                searchVolume: 1000, // Default values since we don't have real data for saved keywords
                competition: 0.5,
                cpc: 1.50,
                matchType: kw.matchType
            }));
            
            keywordData = {
                keywords: {
                    highVolume: formattedKeywords.slice(0, 10),
                    mediumVolume: formattedKeywords.slice(10, 20),
                    lowVolume: [],
                    lowCompetition: formattedKeywords.filter(kw => kw.matchType === 'exact'),
                    all: formattedKeywords
                },
                analysis: {
                    coreTopics: [adGroupContext?.name || 'General'],
                    industryTerms: campaignContext?.isUnitType ? ['real estate', 'property', 'homes'] : [clientInfo?.industry || 'business'],
                    seedKeywords: formattedKeywords.slice(0, 5).map(kw => kw.keyword),
                    targetingInsights: `Keywords saved for ${adGroupContext?.name || 'this ad group'}`
                },
                recommendations: {
                    primaryKeywords: formattedKeywords.slice(0, 5),
                    longTail: formattedKeywords.filter(kw => kw.keyword.split(' ').length >= 3),
                    branded: []
                }
            };
        } else {
            // No saved keywords found - return error
            console.log('✗ No saved keywords found for ad group');
            return res.status(400).json({
                success: false,
                message: 'No keywords found for this ad group',
                error: 'Please generate and save keywords for this ad group before creating ad copy. Go to the Keywords tab, generate keywords, and save them first.'
            });
        }
        
        // Use the OpenAI connector to generate ad copy with keyword context
        const adCopy = await openaiConnector.generateAdCopy(clientInfo, campaignContext, adGroupContext, keywordData);
        
        res.json({
            success: true,
            data: {
                adCopy
            }
        });
        
    } catch (error) {
        console.error('Error generating ad copy:', error);
        handleError(error, res);
    }
});

app.post('/api/generate-keywords', async (req, res) => {
    try {
        console.log('\n=== KEYWORD GENERATION REQUEST ===');
        console.log('Full request body:', JSON.stringify(req.body, null, 2));
        console.log('Client info received:', req.body.clientInfo);
        console.log('Campaign context received:', req.body.campaignContext);
        console.log('Ad group context received:', req.body.adGroupContext);
        console.log('===================================\n');
        
        console.log('Generating keywords for client:', req.body.clientInfo?.clientName || 'Unknown');
        
        if (!semrushConnector) {
            // Return a helpful response instead of throwing an error
            return res.json({
                success: false,
                message: 'Keyword generation is not available',
                reason: 'Semrush API key not configured',
                instructions: {
                    title: 'To enable keyword generation:',
                    steps: [
                        '1. Get your API key from https://www.semrush.com/api-documentation/',
                        '2. Add SEMRUSH_API_KEY=your_key_here to your .env file',
                        '3. Restart the server'
                    ]
                },
                data: {
                    keywords: [],
                    message: 'Configure Semrush API key to generate keyword recommendations'
                }
            });
        }
        
        if (!req.body.adGroupContext || !req.body.adGroupContext.name) {
            throw new AppError(400, 'AD_GROUP_NAME_REQUIRED', 'Ad group name is required for keyword generation');
        }
        let { clientInfo, campaignContext, adGroupContext } = req.body;
        // If this is a unit type campaign, only use adGroupContext.name
        if (campaignContext && campaignContext.isUnitType) {
            clientInfo = {};
            campaignContext = null;
            adGroupContext = { name: adGroupContext.name };
        }
        // Generate keyword recommendations using AI analysis + Semrush data with campaign context
        const keywordData = await semrushConnector.generateKeywordRecommendations(
            clientInfo, 
            campaignContext, 
            adGroupContext
        );
        res.json({
            success: true,
            data: keywordData
        });
    } catch (error) {
        console.error('Error generating keywords:', error);
        handleError(error, res);
    }
});

// Database API endpoints
app.post('/api/migrate-data', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available',
                error: 'Supabase configuration required'
            });
        }

        console.log('=== DATA MIGRATION REQUEST ===');
        const { clientInfo, campaignsData } = req.body;
        
        if (!clientInfo || !campaignsData) {
            return res.status(400).json({
                success: false,
                message: 'Client info and campaigns data required'
            });
        }

        const result = await databaseService.migrateLocalStorageData(clientInfo, campaignsData);
        
        console.log('Migration completed successfully');
        res.json({
            success: true,
            message: 'Data migrated successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Error during migration:', error);
        handleError(error, res);
    }
});

// Client endpoints
app.get('/api/clients', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { data: clients, error } = await databaseService.supabase
            .from('clients')
            .select('id, name, website_url, industry, created_at')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({
            success: true,
            data: clients
        });
        
    } catch (error) {
        console.error('Error fetching clients:', error);
        handleError(error, res);
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const clientData = req.body;
        const client = await databaseService.createClient(clientData);
        
        res.json({
            success: true,
            data: client
        });
        
    } catch (error) {
        console.error('Error creating client:', error);
        handleError(error, res);
    }
});

app.get('/api/clients/:clientId', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { clientId } = req.params;
        const client = await databaseService.getClientWithAllCampaigns(clientId);
        
        res.json({
            success: true,
            data: client
        });
        
    } catch (error) {
        console.error('Error fetching client:', error);
        handleError(error, res);
    }
});

app.get('/api/clients/:clientId/campaigns', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { clientId } = req.params;
        const campaigns = await databaseService.getCampaignsByClient(clientId);
        
        res.json({
            success: true,
            data: campaigns
        });
        
    } catch (error) {
        console.error('Error fetching campaigns for client:', error);
        handleError(error, res);
    }
});

app.put('/api/clients/:clientId', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { clientId } = req.params;
        const updates = req.body;
        
        const client = await databaseService.updateClient(clientId, updates);
        
        res.json({
            success: true,
            data: client
        });
        
    } catch (error) {
        console.error('Error updating client:', error);
        handleError(error, res);
    }
});

app.post('/api/campaigns', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const campaignData = req.body;
        const campaign = await databaseService.createCampaign(campaignData);
        
        res.json({
            success: true,
            data: campaign
        });
        
    } catch (error) {
        console.error('Error creating campaign:', error);
        handleError(error, res);
    }
});

app.get('/api/campaigns/:campaignId', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { campaignId } = req.params;
        const campaign = await databaseService.getCampaignWithFullStructure(campaignId);
        
        res.json({
            success: true,
            data: campaign
        });
        
    } catch (error) {
        console.error('Error fetching campaign:', error);
        handleError(error, res);
    }
});

app.put('/api/campaigns/:campaignId', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { campaignId } = req.params;
        const updates = req.body;
        
        const campaign = await databaseService.updateCampaign(campaignId, updates);
        
        res.json({
            success: true,
            data: campaign
        });
        
    } catch (error) {
        console.error('Error updating campaign:', error);
        handleError(error, res);
    }
});

app.delete('/api/campaigns/:campaignId', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { campaignId } = req.params;
        await databaseService.deleteCampaign(campaignId);
        
        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting campaign:', error);
        handleError(error, res);
    }
});

app.post('/api/ad-groups', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const adGroupData = req.body;
        const adGroup = await databaseService.createAdGroup(adGroupData);
        
        res.json({
            success: true,
            data: adGroup
        });
        
    } catch (error) {
        console.error('Error creating ad group:', error);
        handleError(error, res);
    }
});

app.post('/api/keywords', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const { adGroupId, keywords } = req.body;
        
        // Clear existing keywords for this ad group
        await databaseService.deleteKeywordsByAdGroup(adGroupId);
        
        // Add new keywords
        const keywordData = keywords.map(kw => ({
            ad_group_id: adGroupId,
            text: kw.text,
            match_type: kw.matchType,
            search_volume: kw.searchVolume || 0,
            cpc: kw.cpc || 0,
            competition: kw.competition || 0
        }));
        
        const result = await databaseService.createKeywords(keywordData);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Error saving keywords:', error);
        handleError(error, res);
    }
});

app.post('/api/ads', async (req, res) => {
    try {
        if (!databaseService) {
            return res.status(503).json({
                success: false,
                message: 'Database service not available'
            });
        }

        const adData = req.body;
        const ad = await databaseService.createAd(adData);
        
        res.json({
            success: true,
            data: ad
        });
        
    } catch (error) {
        console.error('Error creating ad:', error);
        handleError(error, res);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    handleError(err, res);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 