"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 10;

// Add this type definition for the result structure
interface BusinessResult {
  name: string;
  email: string | { [key: string]: string };
  phone: string | string[];
  location: string;
  description: string;
  website: string;
  contact: string | { [key: string]: string };
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [emailDomain, setEmailDomain] = useState("@gmail.com");
  const [apiKey, setApiKey] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentResults = results.slice(startIndex, endIndex);

  // Helper function to format complex fields
  const formatField = (field: any): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) return field.join(', ');
    if (typeof field === 'object') {
      return Object.entries(field)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return String(field);
  };

  const handleSearch = async () => {
    if (!apiKey) {
      setError("Please enter your Google API key");
      return;
    }

    setLoading(true);
    setError("");
    setCurrentPage(1);
    try {
      const response = await fetch("/api/generate-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword,
          location,
          emailDomain,
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch results");
      }

      if (data.success && Array.isArray(data.data)) {
        setResults(data.data);
        setHasMore(data.hasMore);
      } else {
        setError("Invalid response format");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await fetch("/api/generate-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword,
          location,
          emailDomain,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch more results");
      }

      if (data.success && Array.isArray(data.data)) {
        setResults(data.data);
        setHasMore(data.hasMore);
      } else {
        setError("Invalid response format");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Lead Generation</CardTitle>
          <CardDescription>
            Search for business leads based on keywords and location
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex gap-4">
              <Input
                placeholder="Enter your Google API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setApiKey("")}
                disabled={!apiKey}
              >
                Clear API Key
              </Button>
            </div>
            
            <div className="flex gap-4">
              <Input
                placeholder="Keyword (e.g., dentist)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Input
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                placeholder="Email Domain"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading || !apiKey}
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 mb-4">{error}</div>
          )}

          {results.length > 0 && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Additional Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {formatField(result.name)}
                        </TableCell>
                        <TableCell>
                          {formatField(result.email)}
                        </TableCell>
                        <TableCell>
                          {formatField(result.phone)}
                        </TableCell>
                        <TableCell>
                          {formatField(result.location)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {formatField(result.description)}
                        </TableCell>
                        <TableCell>
                          {result.website && (
                            <a 
                              href={formatField(result.website)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              Visit
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatField(result.contact)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <CardFooter className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, results.length)} of{" "}
                  {results.length} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>

              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading more..." : "Load more results"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
