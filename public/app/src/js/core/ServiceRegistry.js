/**
 * Shift Craft - Service Registry
 * Decouples module initialization and provides safe startup isolation.
 */
class ServiceRegistry {
    constructor(app) {
        this.app = app;
        this.services = new Map(); // name -> { instance, factory }
    }

    /**
     * Register a service to be initialized later
     * @param {string} name - Service name (e.g. 'patternEngine')
     * @param {function} factory - Function returning the service instance, receiving 'app' as arg
     */
    register(name, factory) {
        this.services.set(name, { factory, instance: null });
    }

    /**
     * Initialize all registered services safely
     * One failure will NOT stop the others
     */
    startAll() {
        console.log(`[ServiceRegistry] Starting ${this.services.size} services...`);

        for (const [name, entry] of this.services) {
            try {
                // Initialize
                const instance = entry.factory(this.app);
                entry.instance = instance;

                // Attach to app instance for backward compatibility (e.g. this.app.patternEngine)
                this.app[name] = instance;

                console.log(`[ServiceRegistry] Service started: ${name}`);
            } catch (error) {
                console.error(`[ServiceRegistry] Failed to start service: ${name}`, error);
                if (this.app.showToast) {
                    this.app.showToast(`Failed to load ${name}`, 'alert-triangle');
                }
            }
        }
    }

    get(name) {
        return this.services.get(name)?.instance;
    }
}

if (typeof window !== 'undefined') {
    window.ServiceRegistry = ServiceRegistry;
}
