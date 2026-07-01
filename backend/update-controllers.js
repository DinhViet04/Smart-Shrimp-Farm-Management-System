const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'src', 'modules');

const modulesToUpdate = ['farms', 'ponds', 'crops', 'five-t-care', 'environment'];

modulesToUpdate.forEach((mod) => {
  const controllerPath = path.join(modulesDir, mod, `${mod}.controller.ts`);
  
  if (fs.existsSync(controllerPath)) {
    const className = mod.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('') + 'Controller';
    
    const content = `import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('${mod}')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ${className} {
  @Get()
  @Roles('FARM_MANAGER', 'FARMER')
  findAll() {
    return { message: 'This action returns all ${mod}' };
  }

  @Post()
  @Roles('FARM_MANAGER', 'FARMER')
  create() {
    return { message: 'This action adds a new ${mod}' };
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'FARMER')
  update() {
    return { message: 'This action updates a ${mod}' };
  }

  @Delete(':id')
  @Roles('FARM_MANAGER') // Only manager can delete
  remove() {
    return { message: 'This action removes a ${mod}' };
  }
}
`;
    fs.writeFileSync(controllerPath, content);
    console.log(`Updated ${controllerPath}`);
  }
});
