import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

// Create axios instance with configuration
const axiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
  }
});

function cleanJsonString(str: string): string {
  str = str.trim();
  
  str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  
  str = str.replace(/,\s*([\]}])/g, "$1");
  str = str.replace(/:\s*'([^']*)'/g, ': "$1"');
  str = str.replace(/\\n/g, " ");
  str = str.replace(/\n/g, " ");
  
  return str;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestCounts = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowData = requestCounts.get(ip) || { count: 0, timestamp: now };

  if (now - windowData.timestamp > RATE_LIMIT_WINDOW) {
    windowData.count = 1;
    windowData.timestamp = now;
  } else {
    windowData.count++;
  }

  requestCounts.set(ip, windowData);
  return windowData.count <= MAX_REQUESTS_PER_WINDOW;
}

// Add this interface at the top of the file
interface SearchResult {
  title: string;
  description: string;
  link?: string;
}

// Add this interface for the API response
interface ApiResponse {
  success: boolean;
  data?: BusinessResult[];
  error?: string;
  message?: string;
  resultsCount?: number;
  totalFound?: number;
  processingRate?: number;
  status?: string;
  ip?: string;
  details?: string;
}

// Add BusinessResult interface to match the processed data
interface BusinessResult {
  name: string;
  email: string | Record<string, string>;
  phone: string | string[];
  location: string;
  description: string;
  website: string;
  contact: string | Record<string, string>;
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({
        success: false,
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later"
      } satisfies ApiResponse, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { keyword, location, emailDomain, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "API key is required",
        message: "Please provide a valid API key"
      } satisfies ApiResponse, { status: 400 });
    }

    if (!keyword) {
      return NextResponse.json({
        success: false,
        error: "Keyword is required",
        message: "Please provide a search keyword"
      } satisfies ApiResponse, { status: 400 });
    }

    // Initialize Gemini with provided API key
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const searchQuery = `${keyword} ${location} ${emailDomain} contact`;
    console.log("\n----------------------------------------");
    console.log("🔍 Search Query:", searchQuery);

    // Reduced to single page fetch for faster results
    try {
      const response = await axiosInstance.get(
        `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=50`, // Reduced to 50 results
        {
          headers: {
            'Cookie': 'CONSENT=YES+1'
          }
        }
      );

      const $ = cheerio.load(response.data);
      
      const searchResults: SearchResult[] = [];
      $('.g').each((i, element) => {
        const title = $(element).find('h3').text();
        const description = $(element).find('.VwiC3b').text();
        const link = $(element).find('a').first().attr('href');
        const snippet = $(element).find('.VwiC3b, .st').text();
        
        if (title && (description || snippet)) {
          searchResults.push({
            title,
            description: description || snippet,
            link: link?.startsWith('/url?q=') ? link.split('/url?q=')[1].split('&')[0] : link
          });
        }
      });

      console.log("📊 Total results found:", searchResults.length);
      console.log("----------------------------------------\n");

      if (searchResults.length === 0) {
        return NextResponse.json({
          success: false,
          error: "No results found",
          details: "The search returned no results"
        } satisfies ApiResponse, { status: 404 });
      }

      // Process in smaller batches
      const BATCH_SIZE = 10;
      const processedResults: BusinessResult[] = [];
      
      for (let i = 0; i < searchResults.length; i += BATCH_SIZE) {
        const batch = searchResults.slice(i, i + BATCH_SIZE);
        const batchText = batch
          .map(r => `Title: ${r.title}\nDescription: ${r.description}\nLink: ${r.link}`)
          .join('\n\n');

        // Modified prompt to be more inclusive
        const prompt = `
          Analyze these Google search results and extract ALL business information.
          Format as JSON array with fields: name, email, phone, location, description (brief), website, contact.
          
          Important instructions:
          1. Include ALL entries that might be businesses
          2. If a field is not found, use empty string ""
          3. For description, use a brief excerpt from the text
          4. Extract any contact information you can find
          5. Include the website URL if available
          6. If you find any email or phone, always include the entry
          7. Try to extract location from the text if possible
          
          Example format:
          [
            {
              "name": "Business Name",
              "email": "email@example.com",
              "phone": "1234567890",
              "location": "City, Area",
              "description": "Brief description",
              "website": "https://example.com",
              "contact": "Additional contact info"
            }
          ]
        `;

        try {
          const result = await model.generateContent([
            { text: prompt },
            { text: batchText }
          ]);
          
          const generatedText = result.response.text().trim();
          const jsonStr = generatedText.replace(/```json\n?|```/g, '').trim();
          const cleanedJson = cleanJsonString(jsonStr);
          
          try {
            const batchProcessed = JSON.parse(cleanedJson) as BusinessResult[];
            
            if (Array.isArray(batchProcessed)) {
              const validResults = batchProcessed.filter((entry): entry is BusinessResult => 
                Boolean(entry.name || entry.email || entry.phone || entry.website)
              );
              processedResults.push(...validResults);
            }
          } catch (jsonError) {
            console.error(`JSON parsing error in batch ${i/BATCH_SIZE + 1}:`, jsonError);
            console.log('Raw JSON:', jsonStr);
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log(`Processed ${Math.min((i + BATCH_SIZE), searchResults.length)} of ${searchResults.length} results...`);
          
        } catch (error) {
          console.error(`Error processing batch ${i/BATCH_SIZE + 1}:`, error);
        }
      }

      console.log("✅ Successfully processed results:", processedResults.length);
      console.log("📊 Processing rate:", Math.round((processedResults.length / searchResults.length) * 100) + "%");

      return NextResponse.json({ 
        success: true, 
        data: processedResults,
        resultsCount: processedResults.length,
        totalFound: searchResults.length,
        processingRate: Math.round((processedResults.length / searchResults.length) * 100)
      } satisfies ApiResponse);

    } catch (searchError) {
      console.error("Search error:", searchError);
      return NextResponse.json({
        success: false,
        error: "Failed to fetch search results",
        message: searchError instanceof Error ? searchError.message : "Search operation failed"
      } satisfies ApiResponse, { status: 500 });
    }

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to process request",
      message: error instanceof Error ? error.message : "Internal server error"
    } satisfies ApiResponse, { status: 500 });
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse<ApiResponse>> {
  try {
    const response = await axios.get("http://httpbin.org/ip", {
      timeout: 5000,
    });

    return NextResponse.json({
      success: true,
      status: "ok",
      ip: response.data.origin,
      message: "Service is healthy"
    } satisfies ApiResponse);
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({
      success: false,
      status: "error",
      error: "Health check failed",
      message: error instanceof Error ? error.message : "Service is unavailable"
    } satisfies ApiResponse, { status: 500 });
  }
}
