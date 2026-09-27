// Entry point of the service bundle (dist/service/service.js). TizenBrew evaluates the bundle in a
// sandbox of its own Node service, so failures are logged rather than thrown: an uncaught error
// here would take TizenBrew's service down with it.
import { Main } from 'src/Main';

Main.start().catch((e) => console.error('BrewCast service failed to start:', e));
