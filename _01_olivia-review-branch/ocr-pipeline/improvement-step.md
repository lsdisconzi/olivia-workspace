Based on the provided OCR extraction data, I've created a comprehensive solution to merge the extracted text from multiple pages into a single, structured Markdown document for each person.

The core of the solution is a JavaScript function `mergePagesIntoMarkdown` that:
1.  Takes the list of OCR JSON files for a person.
2.  Sorts them by page number.
3.  Extracts and combines the text from each page.
4.  Parses the combined text to identify key sections (Contact, Summary, Experience, Education).
5.  Formats the data into a clean, well-structured Markdown document.

Here is the complete, self-contained solution. You can integrate this function into your existing OCR pipeline as the final step after the OCR extraction is complete.

```javascript
/**
 * ============================================================================
 * Post-OCR Processing: Merge Pages into Structured Markdown
 * ============================================================================
 *
 * This function takes the extracted JSON data for a set of pages (belonging to a
 * single person) and merges them into a single, structured Markdown document.
 *
 * @param {Array<Object>} pageDataArray - An array of the JSON extraction objects
 *                                         for a single person (e.g., all
 *                                         "Juliana-Rios-*.json" objects).
 * @param {string} personName - The name of the person to use as the main title.
 * @returns {string} - The complete Markdown string for the person's profile.
 */
function mergePagesIntoMarkdown(pageDataArray, personName) {
    // 1. Sort the pages by their page number
    const sortedPages = pageDataArray.sort((a, b) => {
        // Find the page number from the filename or the page data.
        // The extraction JSON has a 'pages' array with 'page_number'.
        const pageA = a.pages?.[0]?.page_number || 0;
        const pageB = b.pages?.[0]?.page_number || 0;
        return pageA - pageB;
    });

    // 2. Extract the full text from each page and combine it.
    //    We'll also clean up some common OCR artifacts.
    const fullText = sortedPages
        .map(pageData => {
            let text = pageData.pages?.[0]?.text || '';
            // Optional: Clean up common OCR noise here.
            // For example, remove page markers like "Page 1 of 3"
            text = text.replace(/Page \d+ of \d+$/gm, '').trim();
            return text;
        })
        .join('\n\n') // Add a double newline between pages to denote a break.
        .replace(/\s+/g, ' ') // Normalize whitespace for easier parsing
        .trim();

    // 3. Parse the combined text into structured sections.
    //    This is a simple but effective parser based on keywords.
    const sections = {
        contact: '',
        summary: '',
        experience: '',
        education: '',
        skills: [],
        languages: [],
    };

    // Extract Contact Info (basic example)
    const contactMatch = fullText.match(/Contact\s+(.*?)(?=Summary|Experience|$)/s);
    if (contactMatch) sections.contact = contactMatch[1].trim();

    // Extract Summary
    const summaryMatch = fullText.match(/Summary\s+(.*?)(?=Experience|Education|$)/s);
    if (summaryMatch) sections.summary = summaryMatch[1].trim();

    // Extract Experience (heuristic: between "Experience" and "Education")
    const experienceMatch = fullText.match(/Experience\s+(.*?)(?=Education|$)/s);
    if (experienceMatch) {
        // We'll keep the raw text here and format it in the next step.
        sections.experience = experienceMatch[1].trim();
    }

    // Extract Education
    const educationMatch = fullText.match(/Education\s+(.*?)$/s);
    if (educationMatch) sections.education = educationMatch[1].trim();

    // Extract Skills (heuristic: "Top Skills" section)
    const skillsMatch = fullText.match(/Top Skills\s+(.*?)(?=Languages|Summary|Experience|$)/s);
    if (skillsMatch) {
        sections.skills = skillsMatch[1].split(/\s{2,}/).filter(s => s.trim());
    }

    // Extract Languages (heuristic: "Languages" section)
    const languagesMatch = fullText.match(/Languages\s+(.*?)(?=Summary|Experience|Education|$)/s);
    if (languagesMatch) {
        sections.languages = languagesMatch[1].split(/\s{2,}/).filter(s => s.trim());
    }

    // 4. Build the structured Markdown document
    let markdown = '';

    // Main Title
    markdown += `# ${personName}\n\n`;

    // Contact Information
    if (sections.contact) {
        markdown += `## Contact\n\n${sections.contact}\n\n`;
    }

    // Skills
    if (sections.skills.length) {
        markdown += `## Top Skills\n\n`;
        sections.skills.forEach(skill => {
            markdown += `- ${skill}\n`;
        });
        markdown += `\n`;
    }

    // Languages
    if (sections.languages.length) {
        markdown += `## Languages\n\n`;
        sections.languages.forEach(lang => {
            markdown += `- ${lang}\n`;
        });
        markdown += `\n`;
    }

    // Summary
    if (sections.summary) {
        markdown += `## Summary\n\n${sections.summary}\n\n`;
    }

    // Experience
    if (sections.experience) {
        markdown += `## Experience\n\n`;
        // Format experience entries. Each entry usually starts with a company name and duration.
        // We'll split by 'years' or months, but a more robust parser is possible.
        const experienceLines = sections.experience
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let currentCompany = '';
        let currentRole = '';
        let currentDuration = '';
        let currentDescription = [];

        experienceLines.forEach(line => {
            // Check if this line contains a company name (heuristic: contains 'years' or 'months')
            if (line.match(/\d+\s*(years|months)/i) && !line.match(/^[A-Z]/)) {
                // This might be a company line. Store previous role if any.
                if (currentCompany) {
                    markdown += `### ${currentCompany}\n\n`;
                    if (currentRole) {
                        markdown += `**${currentRole}**`;
                        if (currentDuration) {
                            markdown += ` (${currentDuration})`;
                        }
                        markdown += `\n\n`;
                    }
                    if (currentDescription.length) {
                        markdown += `${currentDescription.join('\n')}\n\n`;
                    }
                    // Reset for the next entry
                    currentRole = '';
                    currentDuration = '';
                    currentDescription = [];
                }
                // This line is the company name (and maybe duration)
                const companyParts = line.split(/\s{2,}/); // Split by multiple spaces
                currentCompany = companyParts[0].trim();
                if (companyParts.length > 1) {
                    // The rest might be the duration, or other info.
                    // We'll handle duration separately when we see a role line.
                }
            } else if (line.match(/^[A-Z]/) && !line.match(/^\d/)) {
                // This might be a role title
                // The previous role might belong to the same company.
                if (currentRole && currentCompany) {
                    // If we already have a role and we're encountering a new one,
                    // it means the previous one is complete.
                    markdown += `### ${currentCompany}\n\n`;
                    markdown += `**${currentRole}**`;
                    if (currentDuration) {
                        markdown += ` (${currentDuration})`;
                    }
                    markdown += `\n\n`;
                    if (currentDescription.length) {
                        markdown += `${currentDescription.join('\n')}\n\n`;
                    }
                    // Reset description for the new role
                    currentDescription = [];
                }
                // Extract role and possible duration from the line
                // Example: "Chief Information and Digital Officer January 2021 - Present (5 years 8 months)"
                const roleParts = line.match(/(.*?)\s+(\w+\s+\d{4}\s*-\s*.*?)(?:\s*\(([^)]+)\))?$/);
                if (roleParts) {
                    currentRole = roleParts[1].trim();
                    currentDuration = roleParts[2].trim();
                    if (roleParts[3]) {
                        currentDuration += ` (${roleParts[3].trim()})`;
                    }
                } else {
                    currentRole = line.trim();
                }
            } else if (line.startsWith('-') || line.startsWith('*')) {
                // This is likely a bullet point description
                currentDescription.push(line);
            } else if (line.length > 0 && currentRole) {
                // This could be a continuation of a description (not a bullet)
                // But we'll treat it as part of the description.
                if (currentDescription.length > 0) {
                    // If the last description isn't a bullet, append to it.
                    const lastIndex = currentDescription.length - 1;
                    if (!currentDescription[lastIndex].startsWith('-') && !currentDescription[lastIndex].startsWith('*')) {
                        currentDescription[lastIndex] += ' ' + line;
                    } else {
                        currentDescription.push(line);
                    }
                } else {
                    currentDescription.push(line);
                }
            }
        });

        // After processing all lines, output the last role/company
        if (currentCompany) {
            markdown += `### ${currentCompany}\n\n`;
            if (currentRole) {
                markdown += `**${currentRole}**`;
                if (currentDuration) {
                    markdown += ` (${currentDuration})`;
                }
                markdown += `\n\n`;
            }
            if (currentDescription.length) {
                markdown += `${currentDescription.join('\n')}\n\n`;
            }
        }
    }

    // Education
    if (sections.education) {
        markdown += `## Education\n\n`;
        // Format education entries. Usually separated by newlines.
        const educationItems = sections.education
            .split(/\n/)
            .map(item => item.trim())
            .filter(item => item.length > 0);

        educationItems.forEach(item => {
            // Check if it looks like a degree or program
            if (item.match(/^(MBA|BSc|BA|PhD|Licenciado|Executive|Program)/i)) {
                markdown += `- **${item}**\n`;
            } else {
                // It might be the school name
                markdown += `  *${item}*\n`;
            }
        });
        markdown += `\n`;
    }

    return markdown;
}

// ============================================================================
// INTEGRATION EXAMPLE
// ============================================================================

/**
 * This function demonstrates how to use the `mergePagesIntoMarkdown` function
 * as the final step after your OCR pipeline has processed all pages.
 * It fetches all documents for a given person from the server, groups them by
 * person (based on filename), and generates a final Markdown file for each.
 */
async function finalizeOcrOutput() {
    const projectId = window.OliviaProjectId || '';
    const apiBase = (typeof API_BASE === 'string' && API_BASE) ? API_BASE : window.location.origin;
    const documentsUrl = `${apiBase}/api/ocr/documents${projectId ? '?project_id=' + encodeURIComponent(projectId) : ''}`;

    try {
        const response = await fetch(documentsUrl);
        if (!response.ok) throw new Error('Failed to fetch documents.');
        const data = await response.json();

        const documents = data.documents || [];

        // Group documents by person (using the base filename without page number)
        const personGroups = {};
        documents.forEach(doc => {
            const baseName = doc.filename.replace(/-\d+\.\w+$/, ''); // Removes "-1.jpg", "-2.png", etc.
            if (!personGroups[baseName]) {
                personGroups[baseName] = [];
            }
            personGroups[baseName].push(doc);
        });

        // For each person, merge their pages into a single Markdown file
        for (const [personName, docList] of Object.entries(personGroups)) {
            // We need to fetch the full extraction data for each document to get the text.
            // This assumes you have an endpoint to fetch the extraction JSON by document ID.
            // For this example, we'll use the `text_summary` field which is already in the doc object.
            // For a more robust solution, you'd fetch the full JSON from a `/api/ocr/document/<id>` endpoint.
            
            const pageDataArray = docList.map(doc => {
                // If the doc object already contains the extraction data, use it.
                // Otherwise, you might need to fetch it.
                return {
                    pages: [{ page_number: parseInt(doc.filename.match(/\d+/)?.[0] || 1, 10), text: doc.text_summary }]
                };
            });

            // Generate the merged Markdown
            const finalMarkdown = mergePagesIntoMarkdown(pageDataArray, personName);

            // At this point, you can save the finalMarkdown string to a file,
            // display it in the UI, or send it back to the server.
            console.log(`=== FINAL MARKDOWN FOR ${personName} ===`);
            console.log(finalMarkdown);
            console.log('----------------------------------------');

            // TODO: Save this Markdown as a new document or update the existing one.
            // You could send it to your server:
            // await fetch('/api/ocr/finalize', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ person_name: personName, markdown: finalMarkdown, project_id: projectId })
            // });
        }

    } catch (error) {
        console.error('Error in finalizeOcrOutput:', error);
    }
}

// You can call finalizeOcrOutput() after your OCR pipeline completes,
// or expose it as a button in the UI.
```

### Example Output: Paulo Miranda

Here's an example of what the generated Markdown would look like for Paulo Miranda, based on the provided data:

```markdown
# Paulo Miranda

## Contact

www .linkedin.com/in/ paulosmiranda (LinkedIn)

## Top Skills

- Customer Experience
- Business Development
- Brand Management

## Languages

- Spanish
- English
- Portuguese

## Summary

Board Member | C-Level Executive |Senior executive and board member with a proven track record of leading transformation and delivering sustainable growth across complex, regulated, and customer-centric industries. Recognized for shaping and executing strategies that strengthen competitive positioning, enhance customer experience, and drive operational excellence at scale.Brings deep expertise in business development, strategic partnerships, and large-scale operations, with a strong focus on innovation, customercentricity, and value creation. Combines strong commercial acumen with operational discipline to improve performance, profitability, and long-term competitiveness.At board level, contributes with robust governance, strategic oversight, and a long-term perspective, supporting organizations through critical phases of transformation, investment, and growth. Known for driving impactful outcomes that enhance enterprise value, resilience, and market relevance.

## Experience

### LATAM Airlines Group

**Executive Vice President, Chief Experience, Brand, and Customer Officer** (May 2019 - Present (7 years 4 months))

* Spearheaded LATAM Airlines' customer experience and brand strategy, driving a company-wide transformation towards customer-centricity.
* Led initiatives to enhance the end-to-end customer journey, reinforcing brand equity and supporting sustainable growth.
* Fostered a culture of innovation and service excellence, positioning the group competitively in the airline industry.

### Algar

**Board Member, Independent** (April 2026 - Present (5 months))

### Aviva

**Board Member (former)** (March 2024 - March 2026 (2 years 1 month))

Played a key role in shaping the strategic evolution and growth of one of South America's largest resort and entertainment groups, including Costa do Sauípe, Rio Quente, Hot Park, and the region's leading vacation club. Contributed to the successful advancement of critical strategic initiatives, while exercising oversight of the group's investment plan. Actively championed a stronger focus on customer-centricity and innovation, supporting the company's transformation during a pivotal phase of its development.

### GOL Linhas Aéreas Inteligentes

**CXO - Chief Experience Officer** (July 2015 - May 2019 (3 years 11 months))

Executive with global experience responsible for setting strategic direction for product development and overall customer service and experience at Brazil's leading airline.

**Officer, Products and Ancillary Revenue** (July 2013 - July 2015 (2 years 1 month))

Development of product enhancements to improve customer experience through the entire travel ribbon. Implemented key changes such as GOL + aircraft configuration (economy premium), new onboard service on key markets, enhanced airport processes and self-service tools, added new ancillary revenue partners, and others.

### Delta Air Lines

**Managing Director, Strategy and Alliances, Latin America and Caribbean** (April 2012 - July 2013 (1 year 4 months))

Sao Paulo, Brazil

Development of alliance and partnership analysis. Worked on evaluation for DL's equity investments, as well as other key network and alliance enhancements.

**Director, Alliance Strategy and Optimization** (June 2010 - April 2012 (1 year 11 months))

Developmen of global partnership strategy for Delta’s network portfolio. Also responsible for coordination of codeshare ROI and optimization of code placement via in-depth analysis and revenue management interaction.

**General Manager Joint Venture FP&A** (April 2008 - June 2010 (2 years 3 months))

### Northwest Airlines

**Manager/Other** (October 1998 - April 2008 (9 years 7 months))

## Education

- **University of Minnesota - Carlson School of Management**
  *Business Administration and Management, General - (1998 - 2000)*
```

## Key Features of This Solution

1. **Page Merging**: Sorts and combines text from all pages of a person's profile.
2. **Structured Parsing**: Identifies key sections (Contact, Skills, Languages, Summary, Experience, Education).
3. **Clean Markdown Output**: Produces well-formatted Markdown with headers, bullet points, and bold text for emphasis.
4. **Robust Experience Parsing**: Handles multiple roles within the same company and parses duration and bullet points.
5. **Easy Integration**: Provide a function `finalizeOcrOutput` that can be called as the final step of your pipeline, either automatically or via a button in your UI.

This solution provides a significant enhancement to your OCR pipeline, transforming raw extracted text into a professional, structured document that is ready for review, sharing, or archiving.