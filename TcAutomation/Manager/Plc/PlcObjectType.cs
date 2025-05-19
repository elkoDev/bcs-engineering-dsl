namespace TcAutomation.Manager.Plc
{
    public class PlcObjectType
    {
        public string Name { get; }
        public int Code { get; }
        public bool HasDeclaration { get; }
        public bool HasImplementation { get; }
        public bool RequiresLanguage { get; }

        private PlcObjectType(string name, int code, bool hasDeclaration, bool hasImplementation, bool requiresLanguage = false)
        {
            Name = name;
            Code = code;
            HasDeclaration = hasDeclaration;
            HasImplementation = hasImplementation;
            RequiresLanguage = requiresLanguage;
        }

        public override string ToString() => Name;

        public static PlcObjectType? FromCode(int code) => All.FirstOrDefault(t => t.Code == code);

        public static readonly PlcObjectType Folder = new("Folder", 601, false, false);
        public static readonly PlcObjectType Program = new("Program", 602, true, true, true);
        public static readonly PlcObjectType Function = new("Function", 603, true, true, true);
        public static readonly PlcObjectType FunctionBlock = new("FunctionBlock", 604, true, true, true);
        public static readonly PlcObjectType Enum = new("Enum", 605, true, false);
        public static readonly PlcObjectType Struct = new("Struct", 606, true, false);
        public static readonly PlcObjectType Union = new("Union", 607, true, false);
        public static readonly PlcObjectType Action = new("Action", 608, false, true, true);
        public static readonly PlcObjectType InterfaceMethod = new("InterfaceMethod", 610, true, true);
        public static readonly PlcObjectType Property = new("Property", 611, true, true, true);
        public static readonly PlcObjectType InterfaceProperty = new("InterfaceProperty", 612, true, true);
        public static readonly PlcObjectType PropertyGet = new("PropertyGet", 613, true, true, true);
        public static readonly PlcObjectType PropertySet = new("PropertySet", 614, true, true, true);
        public static readonly PlcObjectType GlobalVariables = new("GlobalVariables", 615, true, false);
        public static readonly PlcObjectType Transition = new("Transition", 616, false, true, true);
        public static readonly PlcObjectType Interface = new("Interface", 618, true, false);
        public static readonly PlcObjectType Alias = new("Alias", 623, true, false);
        public static readonly PlcObjectType ParameterList = new("ParameterList", 629, true, false);
        public static readonly PlcObjectType UMLClassDiagram = new("UMLClassDiagram", 631, false, false);
        public static readonly PlcObjectType InterfacePropertyGet = new("InterfacePropertyGet", 654, false, false);
        public static readonly PlcObjectType InterfacePropertySet = new("InterfacePropertySet", 655, false, false);

        public static readonly IReadOnlyList<PlcObjectType> All = new List<PlcObjectType>
        {
            Folder,
            Program,
            Function,
            FunctionBlock,
            Enum,
            Struct,
            Union,
            Action,
            InterfaceMethod,
            Property,
            InterfaceProperty,
            PropertyGet,
            PropertySet,
            GlobalVariables,
            Transition,
            Interface,
            Alias,
            ParameterList,
            UMLClassDiagram,
            InterfacePropertyGet,
            InterfacePropertySet
        };
    }
}
