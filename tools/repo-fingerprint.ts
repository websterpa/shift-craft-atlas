
import * as fs from 'fs';
import * as path from 'path';

interface Fingerprint {
    framework: "react" | "vanilla" | "vue" | "svelte" | "other";
    persistence: "supabase" | "localstorage" | "firebase" | "other";
    calendar: string | null;
    assignments_loader: string | null;
    mapping_module: string | null;
    has_tests: boolean;
}

const rootDir = process.cwd();

function findFile(dir: string, pattern: RegExp): string | null {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const result = findFile(fullPath, pattern);
            if (result) return result;
        } else {
            if (pattern.test(file)) {
                return path.relative(rootDir, fullPath);
            }
        }
    }
    return null;
}

function scan(): Fingerprint {
    console.log("Scanning repository from:", rootDir);

    // 1. Framework & Persistence from package.json
    let framework: Fingerprint['framework'] = "vanilla";
    let persistence: Fingerprint['persistence'] = "localstorage"; // Default guess
    let has_tests = false;

    if (fs.existsSync(path.join(rootDir, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['react']) framework = "react";
        else if (deps['vue']) framework = "vue";
        else if (deps['svelte']) framework = "svelte";

        if (deps['@supabase/supabase-js']) persistence = "supabase";
        else if (deps['firebase']) persistence = "firebase";

        if (deps['@playwright/test'] || deps['jest'] || deps['vitest']) has_tests = true;
    }

    // 2. Scan code for specific signals
    // Calendar: Look for Monthly View or Calendar Component
    const calendar = findFile(path.join(rootDir, 'src'), /(MonthlyView|CalendarGrid)\.(js|ts|jsx|tsx)$/i)
        || findFile(path.join(rootDir, 'src'), /app\.js$/) // Fallback for vanilla monolithic
        ; // If monolithic, app.js might be the 'view'

    // Assignments: Logic for assignments
    const assignments_loader = findFile(path.join(rootDir, 'src'), /(RosterLogic|AssignmentEngine|useAssignments)\.(js|ts)$/i);

    // Mapping: Export or Transform logic
    const mapping_module = findFile(path.join(rootDir, 'src'), /(RosterExport|ShiftMapping)\.(js|ts)$/i);

    return {
        framework,
        persistence,
        calendar,
        assignments_loader,
        mapping_module,
        has_tests
    };
}

const fingerprint = scan();
console.log("Fingerprint:", JSON.stringify(fingerprint, null, 2));

fs.writeFileSync(path.join(rootDir, 'repo-fingerprint.json'), JSON.stringify(fingerprint, null, 2));
console.log("Written to repo-fingerprint.json");
