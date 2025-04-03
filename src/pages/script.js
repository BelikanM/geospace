const fs = require('fs');
const path = require('path');

// Dossier de base
const baseDir = path.join(__dirname, 'xd'); // Création du dossier "xd"

// Liste des composants à créer
const components = [
  'Header',
  'Footer',
  'Sidebar',
  'MainContent',
  'Button',
  'Card',
  'Modal',
  'Container'
];

// Fonction pour créer un fichier avec du contenu React de base
const createComponentFile = (componentName) => {
  return `
import React from 'react';

const ${componentName} = () => {
  return (
    <div className="${componentName.toLowerCase()}">
      <h1>${componentName}</h1>
    </div>
  );
};

export default ${componentName};
  `;
};

// Fonction principale
const createComponents = () => {
  // Vérification et création du dossier 'xd'
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
    console.log(`Dossier 'xd' créé avec succès.`);
  }

  // Création des fichiers pour chaque composant
  components.forEach((component) => {
    const filePath = path.join(baseDir, `${component}.js`);
    const fileContent = createComponentFile(component);

    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`Composant '${component}.js' créé.`);
  });

  // Génération du fichier Geo.js
  const geoFilePath = path.join(__dirname, 'Geo.js');
  const importStatements = components
    .map((component) => `import ${component} from './xd/${component}';`)
    .join('\n');

  const geoFileContent = `
import React from 'react';

${importStatements}

const Geo = () => {
  return (
    <div>
      <Header />
      <Sidebar />
      <MainContent />
      <Container />
      <Button />
      <Card />
      <Modal />
      <Footer />
    </div>
  );
};

export default Geo;
  `;

  fs.writeFileSync(geoFilePath, geoFileContent, 'utf8');
  console.log(`Fichier 'Geo.js' créé avec succès.`);
};

// Exécution
createComponents();

