import { readdir,realpath,rm } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.env.NEXUS_DEMO_DATA_DIR||'.demo-data');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=process.argv[2];
if(!id){
 console.log('Escenarios DEMO persistidos. Detén el servidor antes de eliminar uno:');
 const entries=await readdir(root,{withFileTypes:true}).catch(()=>[]);
 console.log(entries.filter(f=>f.isDirectory()&&uuid.test(f.name)).map(f=>f.name).join('\n')||'(ninguno)');
 console.log('Eliminar un escenario: npm run demo:cleanup -- UUID');
}else{
 if(!uuid.test(id))throw Error('Se requiere un UUID de escenario válido.');
 const resolvedRoot=await realpath(root);
 const target=await realpath(path.resolve(resolvedRoot,id));
 if(path.dirname(target)!==resolvedRoot||path.basename(target).toLowerCase()!==id.toLowerCase())throw Error('El destino no está dentro del directorio DEMO esperado.');
 console.log(`Eliminando únicamente el escenario DEMO: ${target}`);
 await rm(target,{recursive:true,force:false});
}
