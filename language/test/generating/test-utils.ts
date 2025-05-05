// test-utils.ts
import type {
    Primary,
    ArrayLiteral,
    StructLiteral,
    StructFieldInit,
    BinExpr,
    NegExpr,
    NotExpr,
    ParenExpr,
    Ref,
    VarDecl,
    TypeRef
  } from "../../src/language/generated/ast.js";
  
  /**
   * A helper to create any AstNode shell.
   */
  function makeAstNode<T extends { $type: string }>(
    type: T["$type"]
  ): T & { $container: any; $containerProperty: string; $containerIndex: number } {
    return {
      $type: type,
      $container: null!,
      $containerProperty: "",
      $containerIndex: 0
    } as any;
  }
  
  /** Primary literals and complex literals */
  
  export function makePrimary(val: number | boolean | string): Primary {
    return {
      ...makeAstNode<Primary>("Primary"),
      val
    };
  }
  
  export function makeArrayLiteral(elements: Primary[]): Primary {
    const arr = {
      ...makeAstNode<ArrayLiteral>("ArrayLiteral"),
      elements
    };
    // each element's container must point back at this ArrayLiteral
    elements.forEach((el, i) => {
      el.$container = arr;
      el.$containerProperty = "elements";
      el.$containerIndex = i;
    });
    return {
      ...makeAstNode<Primary>("Primary"),
      val: arr
    };
  }
  
  export function makeStructLiteral(
    fields: Array<{ name: string; value: Primary }>
  ): Primary {
    const inits: StructFieldInit[] = fields.map((f, i) => {
      const init = {
        ...makeAstNode<StructFieldInit>("StructFieldInit"),
        name: f.name,
        value: f.value
      };
      // back-link
      f.value.$container = init;
      f.value.$containerProperty = "value";
      f.value.$containerIndex = 0;
      return init;
    });
    const struc = {
      ...makeAstNode<StructLiteral>("StructLiteral"),
      fields: inits
    };
    inits.forEach((init, i) => {
      init.$container = struc;
      init.$containerProperty = "fields";
      init.$containerIndex = i;
    });
    return {
      ...makeAstNode<Primary>("Primary"),
      val: struc
    };
  }
  
  /** Unary/binary/parens */
  
  export function makeNegExpr(expr: Primary): NegExpr {
    const node = {
      ...makeAstNode<NegExpr>("NegExpr"),
      expr
    };
    expr.$container = node as any;
    expr.$containerProperty = "expr";
    return node as NegExpr;
  }
  
  export function makeNotExpr(expr: Primary): NotExpr {
    const node = {
      ...makeAstNode<NotExpr>("NotExpr"),
      expr
    };
    expr.$container = node as any;
    expr.$containerProperty = "expr";
    return node as NotExpr;
  }
  
  export function makeParenExpr(expr: BinExpr): ParenExpr {
    const node = {
      ...makeAstNode<ParenExpr>("ParenExpr"),
      expr
    };
    expr.$container = node as any;
    expr.$containerProperty = "expr";
    return node as ParenExpr;
  }
  
  export function makeBinExpr(
    e1: Primary,
    op: BinExpr["op"],
    e2: Primary
  ): BinExpr {
    const node = {
      ...makeAstNode<BinExpr>("BinExpr"),
      e1,
      op,
      e2
    };
    e1.$container = node as any;
    e1.$containerProperty = "e1";
    e2.$container = node as any;
    e2.$containerProperty = "e2";
    return node as BinExpr;
  }
  
  /** VarDecl + Ref */
  
  export function makeVarDecl(name: string, typeName: string): VarDecl {
    // allocate shell
    const decl = makeAstNode<VarDecl>("VarDecl") as VarDecl;
    // make TypeRef
    const tref = {
      ...makeAstNode<TypeRef>("TypeRef"),
      type: typeName,
      sizes: [],
      ref: undefined
    } as unknown as TypeRef;
    // link
    tref.$container = decl as any;
    tref.$containerProperty = "typeRef";
    decl.typeRef = tref;
    decl.name = name;
    decl.init = undefined;
    return decl;
  }
  
  export function makeRefToVar(varDecl: VarDecl): Ref {
    const ref: Ref = {
      ...makeAstNode<Ref>("Ref"),
      ref: { ref: varDecl },
      indices: [],
      properties: []
    } as any;
    return ref;
  }
  
  export function makeRefToEnum(enumName: string, memberName: string): Ref {
    const ref: Ref = {
      ...makeAstNode<Ref>("Ref"),
      // we construct a dummy NamedElement for the enum decl and member
      ref: { ref: { $type: "EnumDecl", name: enumName, members: [], isExtern: false } as any },
      indices: [],
      properties: [{ ref: { $type: "EnumMemberDecl", name: memberName } as any }]
    } as any;
    return ref;
  }
  