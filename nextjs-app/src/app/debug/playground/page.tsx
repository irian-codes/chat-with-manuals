'use client';

type Props = {};

export default function Page({}: Props) {
  function doesRegexMatch(str: string, fileName: string, output: string) {
    const regex = new RegExp(
      `^parsedPdf_${fileName.replace('.', '\\.')}_parser-${output}.*_2\\d{11}.(json|txt|md)$`
    );

    console.log(regex);

    return regex.test(str);
  }

  const handleButtonClick = () => {
    const testCases = new Map([
      [
        0,
        'parsedPdf_ttrpg-game_SW_Test_Drive_2020-abridged.pdf_parser-llamaparse_202407101717.md',
      ],
      [
        1,
        'parsedPdf_ttrpg-game_SW_Test_Drive_2020-abridged.pdf_parser-llamaparse-GPT4oON_202406231655.md',
      ],
      [
        2,
        'parsedPdf_ttrpg-game_SW_Test_Drive_2020-abridged.pdf_parser-llamaparse-GPT4oOFF_202406231655.md',
      ],
      [3, ''],
      [4, ' a '],
      [5, 'parsedPdf_product-manual.pdf_parser-llamaparse_202406121011.md'],
      [
        6,
        'parsedPdf_product-manual.pdf_parser-llamaparse-GPT4oON_202406121211.md',
      ],
      [7, 'parsedPdf_product-manual.pdf_parser-langchain_202406181431.md'],
    ]);

    testCases.forEach((str, key, map) => {
      const result = doesRegexMatch(
        str,
        'ttrpg-game_SW_Test_Drive_2020-abridged.pdf',
        'llamaparse'
      );

      console.log(`Test case ${key} : '${str}'`, result);
    });
  };

  return (
    <div>
      <button
        className="m-6 rounded-sm border-2 border-white p-3 hover:border-blue-500 hover:bg-blue-100 hover:text-black"
        onClick={handleButtonClick}
      >
        DEBUG FUNCTION CALL
      </button>
    </div>
  );
}
