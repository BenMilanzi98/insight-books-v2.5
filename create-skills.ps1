# Path to your Gemini skills folder (project-local)
$skillsPath = "$PWD\.gemini\skills"

# Ensure the folder exists
mkdir $skillsPath -Force

# Define all skills with name, folder, and description
$skills = @(
    @{folder="code-explainer"; description="Explains code clearly"},
    @{folder="python-helper"; description="Assist with Python coding"},
    @{folder="node-helper"; description="Assist with JavaScript and Node.js"},
    @{folder="react-helper"; description="Assist with React/Frontend dev"},
    @{folder="api-helper"; description="Design and debug backend APIs"},
    @{folder="sql-expert"; description="SQL and database optimization"},
    @{folder="regex-builder"; description="Create and explain regular expressions"},
    @{folder="test-generator"; description="Auto-generate unit and integration tests"},
    @{folder="refactor-assistant"; description="Suggest code refactors"},
    @{folder="devops-helper"; description="CI/CD, Docker, deployment"},
    @{folder="ml-helper"; description="AI and ML coding"},
    @{folder="web-scraper"; description="Build web scraping tools"},
    @{folder="security-auditor"; description="Identify vulnerabilities"},
    @{folder="performance-optimizer"; description="Optimize code performance"},
    @{folder="doc-writer"; description="Generate docs for code/projects"},
    @{folder="debug-helper"; description="Analyze logs and debug"},
    @{folder="cli-builder"; description="Build command line tools"},
    @{folder="json-yaml"; description="Work with JSON/YAML"},
    @{folder="git-helper"; description="Git commands and workflows"},
    @{folder="api-tester"; description="Test APIs automatically"},
    @{folder="docker-helper"; description="Docker and containerization"},
    @{folder="k8s-helper"; description="Kubernetes and orchestration"},
    @{folder="cicd-helper"; description="Continuous integration and delivery"},
    @{folder="cloud-helper"; description="AWS/GCP/Azure support"},
    @{folder="testing-framework"; description="Work with Jest, PyTest, Mocha"},
    @{folder="frontend-optimizer"; description="Optimize web frontend"},
    @{folder="accessibility-helper"; description="Improve web accessibility"},
    @{folder="mobile-helper"; description="React Native / Flutter"},
    @{folder="monitoring-helper"; description="Logs, alerts, metrics"},
    @{folder="fullstack-helper"; description="Full-stack development guidance"},
    @{folder="ai-agent"; description="Multi-step coding workflows"}
)

# Loop through each skill and create folder + SKILL.md
foreach ($skill in $skills) {
    $folderPath = Join-Path $skillsPath $skill.folder
    mkdir $folderPath -Force

    $skillContent = @"
---
name: $($skill.folder)
description: $($skill.description)
---
$($skill.description)
"@

    $skillFile = Join-Path $folderPath "SKILL.md"
    $skillContent | Out-File -FilePath $skillFile -Encoding utf8
}

Write-Host "✅ All 31 skills created successfully in $skillsPath"